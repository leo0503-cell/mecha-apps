import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "CubiCarga",
    short_name: "CubiCarga",
    description: "Calculadora de cubicaje y plan de carga recomendado",
    lang: "es-MX",
    start_url: "/calculadora",
    scope: "/",
    display: "standalone",
    background_color: "#F4F6F8",
    theme_color: "#0F2A44",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
