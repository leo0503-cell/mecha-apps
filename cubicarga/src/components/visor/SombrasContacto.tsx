"use client";
/** Adaptación acotada de ContactShadows de @react-three/drei (MIT):
 * recursos estables por dimensiones y limpieza explícita de targets/materiales.
 * La implementación instalada recreaba targets al cambiar identidad de scale.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { HorizontalBlurShader, VerticalBlurShader } from "three-stdlib";

export function ContactShadows({
  position,
  scale,
  far,
  blur,
  opacity,
  resolution,
  frames,
}: {
  position: [number, number, number];
  scale: [number, number];
  far: number;
  blur: number;
  opacity: number;
  resolution: number;
  frames: number;
}) {
  const [width, height] = scale;
  const [x, y, z] = position;
  const count = useRef(0);
  const mesh = useRef<THREE.Mesh>(null);
  const recursos = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(resolution, resolution);
    const blurred = new THREE.WebGLRenderTarget(resolution, resolution);
    target.texture.generateMipmaps = blurred.texture.generateMipmaps = false;
    const geometry = new THREE.PlaneGeometry(width, height).rotateX(
      Math.PI / 2,
    );
    const depth = new THREE.MeshDepthMaterial();
    depth.depthTest = depth.depthWrite = false;
    depth.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4( vec3( 1.0 - fragCoordZ ), opacity );",
        "vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) );",
      );
    };
    const horizontal = new THREE.ShaderMaterial(HorizontalBlurShader);
    const vertical = new THREE.ShaderMaterial(VerticalBlurShader);
    horizontal.depthTest = vertical.depthTest = false;
    const plane = new THREE.Mesh(geometry, horizontal);
    const camera = new THREE.OrthographicCamera(
      -width / 2,
      width / 2,
      height / 2,
      -height / 2,
      0,
      far,
    );
    camera.position.copy(new THREE.Vector3(x, y, z));
    camera.rotation.x = Math.PI / 2;
    camera.updateMatrixWorld();
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      map: target.texture,
      opacity,
      depthWrite: false,
    });
    return {
      target,
      blurred,
      geometry,
      depth,
      horizontal,
      vertical,
      plane,
      camera,
      material,
    };
  }, [width, height, far, resolution, x, y, z, opacity]);
  useEffect(() => {
    count.current = 0;
    return () => {
      recursos.target.dispose();
      recursos.blurred.dispose();
      recursos.geometry.dispose();
      recursos.depth.dispose();
      recursos.horizontal.dispose();
      recursos.vertical.dispose();
      recursos.material.dispose();
    };
  }, [recursos]);
  useFrame(({ gl, scene }) => {
    if (!mesh.current || count.current >= frames) return;
    count.current++;
    const r = recursos;
    const background = scene.background,
      override = scene.overrideMaterial;
    const previous = gl.getRenderTarget();
    mesh.current.visible = false;
    try {
      scene.background = null;
      scene.overrideMaterial = r.depth;
      gl.setRenderTarget(r.target);
      gl.render(scene, r.camera);
      const applyBlur = (amount: number) => {
        r.plane.material = r.horizontal;
        r.horizontal.uniforms.tDiffuse.value = r.target.texture;
        r.horizontal.uniforms.h.value = amount / 256;
        gl.setRenderTarget(r.blurred);
        gl.render(r.plane, r.camera);
        r.plane.material = r.vertical;
        r.vertical.uniforms.tDiffuse.value = r.blurred.texture;
        r.vertical.uniforms.v.value = amount / 256;
        gl.setRenderTarget(r.target);
        gl.render(r.plane, r.camera);
      };
      // La geometría de blur usa el origen de su propia escena.
      const cameraPosition = r.camera.position.clone();
      r.camera.position.set(0, 0, 0);
      r.camera.updateMatrixWorld();
      try {
        applyBlur(blur);
        applyBlur(blur * 0.4);
      } finally {
        r.camera.position.copy(cameraPosition);
        r.camera.updateMatrixWorld();
      }
    } finally {
      gl.setRenderTarget(previous);
      scene.background = background;
      scene.overrideMaterial = override;
      mesh.current.visible = true;
    }
  });
  return (
    <mesh
      ref={mesh}
      geometry={recursos.geometry}
      material={recursos.material}
      position={position}
      scale={[1, -1, 1]}
      dispose={null}
    />
  );
}
