"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
/** Texturas deterministas locales; no se descargan fotografías. */
export function texturaProcedural(
  tipo: "carton" | "madera" | "acero",
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle =
    tipo === "madera" ? "#bd9361" : tipo === "acero" ? "#b6c0ca" : "#ede5d8";
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i++) {
    const n = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    g.strokeStyle = `rgba(15,42,68,${tipo === "acero" ? 0.1 : 0.025 + Math.abs(n) * 0.07})`;
    g.beginPath();
    if (tipo === "acero") {
      g.moveTo(i * 8, 0);
      g.lineTo(i * 8, 128);
    } else {
      g.moveTo(0, i);
      g.bezierCurveTo(40, i + Math.sin(i) * 2, 80, i + Math.cos(i) * 2, 128, i);
    }
    g.stroke();
  }
  if (tipo === "carton") {
    g.strokeStyle = "rgba(15,42,68,.65)";
    g.lineWidth = 3;
    g.strokeRect(2, 2, 124, 124);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
/** Muestrea frames efectivos de R3F; no usa un temporizador ajeno a la escena. */
export function PresupuestoFps({ onLento }: { onLento: () => void }) {
  const sample = useRef({ tiempo: 0, frames: 0, bajo: 0 });
  useFrame((_, delta) => {
    if (document.hidden) return;
    const s = sample.current;
    s.tiempo += delta;
    s.frames++;
    if (s.tiempo < 0.5) return;
    const fps = s.frames / s.tiempo;
    s.bajo = fps < 30 ? s.bajo + s.tiempo : 0;
    s.frames = 0;
    s.tiempo = 0;
    if (s.bajo >= 2) {
      s.bajo = 0;
      onLento();
    }
  });
  return null;
}
