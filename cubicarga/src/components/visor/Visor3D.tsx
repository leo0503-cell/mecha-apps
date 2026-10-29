"use client";
import { cubicBezier } from "motion";

/**
 * Visor 3D del plan de carga (R3F). Un InstancedMesh por tipo de sólido:
 * cajas (color por SKU o peso) y tarimas. Coordenadas del motor (mm):
 * X largo → three X, Y ancho → three Z, Z alto → three Y. Escala 1 m = 1 unidad.
 */
import {
  Canvas,
  useThree,
  useFrame,
  type ThreeEvent,
} from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { ContactShadows } from "./SombrasContacto";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
import { texturaProcedural, PresupuestoFps } from "./efectos";
import type { Colocacion, Equipo, Material, PlanCarga } from "@/motor";

export type VistaVisor = "iso" | "puerta" | "lateral" | "superior";
export type ColorPor = "sku" | "peso";

export interface PropsVisor {
  plan: PlanCarga;
  equipoIdx?: number;
  /** Paso máximo visible (null = todos). */
  paso?: number | null;
  vista?: VistaVisor;
  colorPor?: ColorPor;
  /** Fracción 0–1 del largo visible (plano de corte). */
  corte?: number;
  onSeleccion?: (c: Colocacion | null, idx: number | null) => void;
  seleccion?: number | null;
  simple?: boolean;
  reducido?: boolean;
  velocidad?: number;
  explotar?: number;
  onLento?: () => void;
}

const S = 1 / 1000;
const easing = cubicBezier(0.2, 0.8, 0.2, 1);

function colorPeso(f: number): THREE.Color {
  // Azul (ligero) → amarillo → rojo (pesado); legible para daltónicos por luminancia.
  const c = new THREE.Color();
  c.setHSL(0.62 - 0.62 * Math.min(1, Math.max(0, f)), 0.85, 0.35 + 0.25 * f);
  return c;
}

function Cajas({
  cols,
  mats,
  colorPor,
  onSeleccion,
  seleccion,
  todas,
  e,
  simple,
  reducido,
  velocidad,
  explotar,
}: {
  cols: Colocacion[];
  todas: Colocacion[];
  e: Equipo;
  simple: boolean;
  reducido: boolean;
  velocidad: number;
  explotar: number;
  mats: Map<string, Material>;
  colorPor: ColorPor;
  onSeleccion?: PropsVisor["onSeleccion"];
  seleccion?: number | null;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tex = useMemo(
    () =>
      typeof document !== "undefined" ? texturaProcedural("carton") : null,
    [],
  );
  useEffect(() => () => tex?.dispose(), [tex]);

  const [hover, setHover] = useState<number | null>(null);
  const animacion = useRef<{
    inicio: number;
    intro: boolean;
    calentamiento: number;
    nuevas: Map<Colocacion, number>;
  } | null>(null);
  const previas = useRef(new Set<Colocacion>()),
    prevMats = useRef(mats),
    initialized = useRef(false);
  const explosion = useRef({
    actual: explotar,
    desde: explotar,
    hasta: explotar,
    inicio: 0,
  });
  const scratch = useMemo(
    () => ({
      o: new THREE.Object3D(),
      destino: new THREE.Vector3(),
      puerta: new THREE.Vector3(),
      dentro: new THREE.Vector3(),
    }),
    [],
  );
  useEffect(() => {
    explosion.current = {
      actual: explosion.current.actual,
      desde: explosion.current.actual,
      hasta: explotar,
      inicio: performance.now(),
    };
  }, [explotar]);
  useFrame(() => {
    const mesh = ref.current,
      a = animacion.current,
      exp = explosion.current;
    if (!mesh) return;
    const now = performance.now();
    if (a && a.calentamiento > 0) {
      a.inicio = now;
      a.calentamiento--;
    }
    const fexp = reducido ? 1 : Math.min(1, (now - exp.inicio) / 350);
    exp.actual =
      exp.desde + (exp.hasta - exp.desde) * fexp * fexp * (3 - 2 * fexp);
    if (!a && fexp === 1) return;
    let activa = false;
    cols.forEach((c, i) => {
      const orden = a?.nuevas.get(c),
        duracion = a?.intro ? 300 : 300 / velocidad;
      const delay =
        orden == null
          ? 0
          : a?.intro
            ? a.nuevas.size > 1
              ? (orden * 1200) / (a.nuevas.size - 1)
              : 0
            : orden * duracion;
      const t =
        reducido || orden == null
          ? 1
          : Math.min(1, Math.max(0, (now - a!.inicio - delay) / duracion));
      if (t < 1) activa = true;
      scratch.destino.set(
        (c.x + c.l / 2) * S,
        (c.z + c.h / 2 + (c.capa - 1) * exp.actual) * S,
        (c.y + c.a / 2) * S,
      );
      scratch.puerta.set(
        (e.largo + c.l / 2 + 500) * S,
        (c.h / 2) * S,
        (e.ancho / 2) * S,
      );
      scratch.dentro.set(
        (e.largo - c.l / 2) * S,
        (c.h / 2) * S,
        (e.ancho / 2) * S,
      );
      const f = easing(t);
      if (f < 0.55)
        scratch.o.position.lerpVectors(
          scratch.puerta,
          scratch.dentro,
          f / 0.55,
        );
      else
        scratch.o.position.lerpVectors(
          scratch.dentro,
          scratch.destino,
          (f - 0.55) / 0.45,
        );
      scratch.o.scale.set(c.l * S * 0.998, c.h * S * 0.998, c.a * S * 0.998);
      if (t === 0) scratch.o.scale.setScalar(0);
      scratch.o.updateMatrix();
      mesh.setMatrixAt(i, scratch.o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (!activa && a) {
      animacion.current = null;
      mesh.computeBoundingSphere();
    }
  });
  const pesos = useMemo(() => {
    const ps = [...mats.values()].map((m) => m.peso);
    return { min: Math.min(...ps), max: Math.max(...ps) };
  }, [mats]);

  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    cols.forEach((c, i) => {
      o.position.set(
        (c.x + c.l / 2) * S,
        (c.z + c.h / 2 + (c.capa - 1) * explotar) * S,
        (c.y + c.a / 2) * S,
      );
      o.scale.set(c.l * S * 0.998, c.h * S * 0.998, c.a * S * 0.998);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const mat = mats.get(c.materialId);
      if (seleccion != null && todas[seleccion] === c) col.set("#f97316");
      else if (hover === i) col.set("#ffd08a");
      else if (colorPor === "peso" && mat)
        col.copy(
          colorPeso(
            pesos.max > pesos.min
              ? (mat.peso - pesos.min) / (pesos.max - pesos.min)
              : 0.5,
          ),
        );
      else col.set(mat?.color ?? "#0072B2");
      m.setColorAt(i, col);
    });
    m.count = cols.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();

    const intro = !initialized.current || prevMats.current !== mats;
    const nuevas = new Map<Colocacion, number>();
    cols.forEach((c) => {
      if (intro || !previas.current.has(c)) nuevas.set(c, nuevas.size);
    });
    if (!reducido && nuevas.size)
      animacion.current = {
        inicio: performance.now(),
        intro,
        nuevas,
        calentamiento: 2,
      };
    previas.current = new Set(cols);
    prevMats.current = mats;
    initialized.current = true;
  }, [
    cols,
    mats,
    colorPor,
    pesos,
    seleccion,
    todas,
    hover,
    reducido,
    explotar,
  ]);

  const max = Math.max(1, todas.length);
  const contorno =
    seleccion != null ? todas[seleccion] : hover != null ? cols[hover] : null;
  return (
    <group>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, max]}
        onPointerMove={
          simple
            ? undefined
            : (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHover(e.instanceId ?? null);
              }
        }
        onPointerOut={() => setHover(null)}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.instanceId == null) return;
          const c = cols[e.instanceId];
          onSeleccion?.(c, todas.indexOf(c));
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        {simple ? (
          <meshBasicMaterial />
        ) : (
          <meshStandardMaterial map={tex} roughness={0.8} metalness={0} />
        )}
      </instancedMesh>
      {contorno && (
        <mesh
          position={[
            (contorno.x + contorno.l / 2) * S,
            (contorno.z + contorno.h / 2 + (contorno.capa - 1) * explotar) * S,
            (contorno.y + contorno.a / 2) * S,
          ]}
          scale={[
            contorno.l * S * 1.035,
            contorno.h * S * 1.035,
            contorno.a * S * 1.035,
          ]}
        >
          <boxGeometry />
          <meshBasicMaterial
            color={seleccion != null ? "#F97316" : "#ffd08a"}
            side={THREE.BackSide}
          />
        </mesh>
      )}
    </group>
  );
}

function Tarimas({
  plan,
  equipoIdx,
  paso,
  simple,
}: {
  plan: PlanCarga;
  equipoIdx: number;
  paso: number | null;
  simple: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const madera = useMemo(() => texturaProcedural("madera"), []);
  useEffect(() => () => madera.dispose(), [madera]);
  const lista = useMemo(
    () =>
      plan.tarimasArmadas.filter(
        (t) => t.equipoIdx === equipoIdx && (paso == null || t.paso <= paso),
      ),
    [plan, equipoIdx, paso],
  );
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    lista.forEach((t, i) => {
      const l = t.l - 2 * t.offset;
      const a = t.a - 2 * t.offset;
      o.position.set(
        (t.x + t.offset + l / 2) * S,
        (t.z + t.hTarima / 2) * S,
        (t.y + t.offset + a / 2) * S,
      );
      o.scale.set(l * S, t.hTarima * S, a * S);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = lista.length;
    m.instanceMatrix.needsUpdate = true;
  }, [lista]);
  if (plan.tarimasArmadas.length === 0) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(1, plan.tarimasArmadas.length)]}
    >
      <boxGeometry args={[1, 1, 1]} />
      {simple ? (
        <meshBasicMaterial color="#b07a45" />
      ) : (
        <meshStandardMaterial map={madera} roughness={0.9} />
      )}
    </instancedMesh>
  );
}

function Equipo3D({ e, simple }: { e: Equipo; simple: boolean }) {
  const acero = useMemo(() => texturaProcedural("acero"), []);
  useEffect(() => () => acero.dispose(), [acero]);
  const pared1 = useRef<THREE.MeshBasicMaterial>(null),
    pared2 = useRef<THREE.MeshBasicMaterial>(null);
  const centro = useMemo(
    () =>
      new THREE.Vector3((e.largo * S) / 2, (e.alto * S) / 2, (e.ancho * S) / 2),
    [e],
  );
  useFrame(({ camera }) => {
    const op = Math.max(
      0.025,
      Math.min(
        0.12,
        (camera.position.distanceTo(centro) / (e.largo * S)) * 0.1,
      ),
    );
    if (pared1.current) pared1.current.opacity = op;
    if (pared2.current) pared2.current.opacity = op;
  });

  const L = e.largo * S;
  const W = e.ancho * S;
  const H = e.alto * S;
  const caja = useMemo(() => {
    const base = new THREE.BoxGeometry(L, H, W);
    const borde = new THREE.EdgesGeometry(base);
    base.dispose();
    return borde;
  }, [L, H, W]);
  const puerta = useMemo(() => {
    const base = new THREE.PlaneGeometry(e.puertaAncho * S, e.puertaAlto * S);
    const borde = new THREE.EdgesGeometry(base);
    base.dispose();
    return borde;
  }, [e.puertaAncho, e.puertaAlto]);
  const altura = useMemo(() => {
    const base = new THREE.BoxGeometry(L, 0, W);
    const borde = new THREE.EdgesGeometry(base);
    base.dispose();
    return borde;
  }, [L, W]);
  useEffect(
    () => () => {
      caja.dispose();
    },
    [caja],
  );
  useEffect(
    () => () => {
      puerta.dispose();
    },
    [puerta],
  );
  useEffect(
    () => () => {
      altura.dispose();
    },
    [altura],
  );
  const pa = e.puertaAncho * S;
  const ph = e.puertaAlto * S;
  return (
    <group>
      <lineSegments geometry={caja} position={[L / 2, H / 2, W / 2]}>
        <lineBasicMaterial color="#64748b" />
      </lineSegments>
      {/* Paredes semitransparentes (no la de la puerta) */}
      {e.tieneParedes !== false && (
        <>
          <mesh position={[L / 2, H / 2, 0]}>
            <planeGeometry args={[L, H]} />
            <meshBasicMaterial
              ref={pared1}
              map={simple ? null : acero}
              color="#94a3b8"
              transparent
              opacity={0.07}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, H / 2, W / 2]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[W, H]} />
            <meshBasicMaterial
              ref={pared2}
              map={simple ? null : acero}
              color="#94a3b8"
              transparent
              opacity={0.07}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[L / 2, -0.001, W / 2]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color="#9aa5b1" />
      </mesh>
      {/* Puerta en naranja */}
      <mesh
        position={[L + 0.002, ph / 2, W / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[pa, ph]} />
        <meshBasicMaterial
          color="#f97316"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <lineSegments
        position={[L + 0.003, ph / 2, W / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <primitive object={puerta} attach="geometry" />
        <lineBasicMaterial color="#f97316" />
      </lineSegments>
      {/* Línea roja de altura útil (reefer) */}
      {e.alturaUtil < e.alto && (
        <lineSegments position={[L / 2, e.alturaUtil * S, W / 2]}>
          <primitive object={altura} attach="geometry" />
          <lineBasicMaterial color="#dc2626" />
        </lineSegments>
      )}
    </group>
  );
}

function Camara({
  e,
  vista,
  reducido,
  cancelarRef,
}: {
  e: Equipo;
  vista: VistaVisor;
  reducido: boolean;
  cancelarRef: RefObject<boolean>;
}) {
  const transicion = useRef<{
    inicio: number;
    desde: THREE.Vector3;
    objetivo: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);

  const { camera, controls, size } = useThree();
  useEffect(() => {
    const L = e.largo * S;
    const W = e.ancho * S;
    const H = e.alto * S;
    const t = new THREE.Vector3(L / 2, H / 2, W / 2);
    const dir: Record<VistaVisor, THREE.Vector3> = {
      iso: new THREE.Vector3(0.55, 0.6, 1),
      puerta: new THREE.Vector3(1, 0.25, 0),
      lateral: new THREE.Vector3(0, 0.12, 1),
      superior: new THREE.Vector3(0, 1, 0.0001),
    };
    // Distancia para que quepa la esfera envolvente con el fov vertical y horizontal.
    const r = 0.5 * Math.hypot(L, W, H);
    const cam = camera as THREE.PerspectiveCamera;
    const v = THREE.MathUtils.degToRad(cam.fov) / 2;
    const h = Math.atan(Math.tan(v) * (size.width / Math.max(1, size.height)));
    const d = (r / Math.sin(Math.min(v, h))) * 1.02;

    const destino = t
      .clone()
      .add(dir[vista].clone().normalize().multiplyScalar(d));
    cancelarRef.current = false;
    if (reducido) camera.position.copy(destino);
    else
      transicion.current = {
        inicio: performance.now(),
        desde: camera.position.clone(),
        objetivo: destino,
        target: t,
      };

    camera.lookAt(t);
    const c = controls as unknown as OrbitImpl | null;
    if (c) {
      c.target.copy(t);
      c.update();
    }
  }, [
    e,
    vista,
    camera,
    controls,
    size.width,
    size.height,
    reducido,
    cancelarRef,
  ]);
  useFrame(() => {
    const t = transicion.current;
    if (!t) return;
    if (cancelarRef.current) {
      transicion.current = null;
      return;
    }
    const f = Math.min(1, (performance.now() - t.inicio) / 600);
    camera.position.copy(t.desde).lerp(t.objetivo, easing(f));
    camera.lookAt(t.target);
    if (f === 1) transicion.current = null;
  });
  return null;
}

function Sombras({ e, reducido }: { e: Equipo; reducido: boolean }) {
  const [lista, setLista] = useState(reducido);
  useEffect(() => {
    const t = setTimeout(() => setLista(true), 1700);
    return () => clearTimeout(t);
  }, []);
  return lista ? (
    <ContactShadows
      position={[(e.largo * S) / 2, 0.002, (e.ancho * S) / 2]}
      scale={[e.largo * S * 1.2, e.ancho * S * 1.5]}
      far={e.alto * S + 1}
      blur={2}
      opacity={0.35}
      resolution={256}
      frames={1}
    />
  ) : null;
}
export default function Visor3D({
  plan,
  equipoIdx = 0,
  paso = null,
  vista = "iso",
  colorPor = "sku",
  corte = 1,
  onSeleccion,
  seleccion,
  simple = false,
  reducido = false,
  velocidad = 1,
  explotar = 0,
  onLento,
}: PropsVisor) {
  const cancelarAuto = useRef(false);
  const e = plan.equipos[equipoIdx];
  const mats = useMemo(
    () => new Map(plan.materiales.map((m) => [m.id, m])),
    [plan],
  );
  const todas = useMemo(
    () => plan.colocaciones.filter((c) => c.equipoIdx === equipoIdx),
    [plan, equipoIdx],
  );
  const visibles = useMemo(
    () =>
      todas.filter(
        (c) =>
          (paso == null || c.paso <= paso) && c.x < (e?.largo ?? 0) * corte,
      ),
    [todas, paso, corte, e?.largo],
  );
  const sombraKey = useMemo(
    () =>
      plan.colocaciones.reduce(
        (h, c) =>
          (Math.imul(h, 31) +
            c.x +
            3 * c.y +
            7 * c.z +
            11 * c.l +
            13 * c.a +
            17 * c.h) |
          0,
        0,
      ),
    [plan],
  );
  if (!e) return null;
  return (
    <Canvas
      camera={{ fov: 40, near: 0.05, far: 500, position: [10, 6, 10] }}
      dpr={[1, simple ? 1 : 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSeleccion?.(null, null)}
      className="touch-none"
    >
      <color attach="background" args={["#e9edf2"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 14, 6]} intensity={1.1} />
      <directionalLight position={[-6, 6, -8]} intensity={0.35} />
      <Equipo3D e={e} simple={simple} />
      <Tarimas plan={plan} equipoIdx={equipoIdx} paso={paso} simple={simple} />
      <Cajas
        cols={visibles}
        todas={plan.colocaciones}
        mats={mats}
        colorPor={colorPor}
        onSeleccion={onSeleccion}
        seleccion={seleccion}
        e={e}
        simple={simple}
        reducido={reducido}
        velocidad={velocidad}
        explotar={explotar}
      />
      <Grid
        args={[60, 60]}
        position={[(e.largo * S) / 2, -0.002, (e.ancho * S) / 2]}
        cellSize={1}
        sectionSize={5}
        cellColor="#b8c2cc"
        sectionColor="#7b8794"
        fadeDistance={60}
        infiniteGrid={false}
      />
      <OrbitControls
        makeDefault
        enableDamping={!reducido}
        onStart={() => {
          cancelarAuto.current = true;
        }}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={1}
        maxDistance={80}
      />
      {!simple && (
        <Sombras
          e={e}
          reducido={reducido}
          key={String(sombraKey) + ":" + equipoIdx + ":" + paso}
        />
      )}
      {onLento && !simple && <PresupuestoFps onLento={onLento} />}
      <Camara
        e={e}
        vista={vista}
        reducido={reducido}
        cancelarRef={cancelarAuto}
      />
    </Canvas>
  );
}
