import fs from "node:fs";
import sharp from "sharp";
const logo =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0F2A44"/><path d="M256 92 400 176 256 260 112 176Z" fill="#F97316"/><path d="M112 192 244 269V420L112 343Z" fill="#E5E7EB"/><path d="M268 269 400 192V343L268 420Z" fill="#C45E19"/></svg>';
fs.writeFileSync("public/logo-cubo.svg", logo);
fs.writeFileSync("src/app/icon.svg", logo);
for (const size of [192, 512])
  await sharp(Buffer.from(logo))
    .resize(size, size)
    .png()
    .toFile(`public/icon-${size}.png`);
await sharp(Buffer.from(logo))
  .resize(400, 400)
  .extend({ top: 56, bottom: 56, left: 56, right: 56, background: "#0F2A44" })
  .png()
  .toFile("public/icon-maskable-512.png");
const equipos = [
    "20dv",
    "40dv",
    "40hc",
    "caja-seca",
    "torton",
    "rabon",
    "camioneta",
    "uld",
    "rack",
  ],
  tarimas = [
    "gma",
    "eur",
    "iso2",
    "t11",
    "1067",
    "1140",
    "australiana",
    "media-eur",
  ];
function iso(tipo) {
  const largo = tipo === "20dv" ? 150 : tipo === "camioneta" ? 130 : 210;
  const cabina = ["caja-seca", "torton", "rabon", "camioneta"].includes(tipo)
    ? '<path d="M235 158V98L280 111 308 152V194L276 212Z" fill="#F97316" stroke="#0F2A44" stroke-width="3"/><circle cx="270" cy="201" r="14" fill="#0F2A44"/><circle cx="91" cy="158" r="14" fill="#0F2A44"/>'
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 250"><path d="M45 117 120 67 ${120 + largo} 115 ${45 + largo} 165Z" fill="#E5E7EB" stroke="#0F2A44" stroke-width="3"/><path d="M45 117V181L${45 + largo} 230V165Z" fill="#0F2A44"/><path d="M${45 + largo} 165 ${120 + largo} 115V180L${45 + largo} 230Z" fill="#F97316" stroke="#0F2A44" stroke-width="3"/>${cabina}${tipo === "rack" ? '<path d="M55 110V217M120 60V160M252 164V235M330 109V185M55 155 252 209M120 109 330 159" stroke="#F97316" stroke-width="10"/>' : ""}${tipo === "uld" ? '<path d="M48 60 220 15 320 50 200 83Z" fill="none" stroke="#0F2A44" stroke-width="5"/>' : ""}</svg>`;
}
for (const tipo of equipos)
  fs.writeFileSync(`public/ilustraciones/${tipo}.svg`, iso(tipo));
for (const tipo of tarimas)
  fs.writeFileSync(
    `public/ilustraciones/tarima-${tipo}.svg`,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 200"><path d="M50 105 140 50 310 94 220 155Z" fill="#E5E7EB" stroke="#0F2A44" stroke-width="4"/><path d="M50 105V128L220 178V155Z" fill="#0F2A44"/><path d="M220 155 310 94V119L220 178Z" fill="#F97316"/><path d="M87 116 177 61M128 127 216 72M169 139 256 83" stroke="#0F2A44" stroke-width="8"/></svg>',
  );
for (const tipo of ["sin-proyectos", "sin-materiales", "sin-resultados"])
  fs.writeFileSync(`public/ilustraciones/${tipo}.svg`, iso("20dv"));
const foto = iso("40hc")
  .replace(
    'viewBox="0 0 360 250"',
    'viewBox="0 0 360 250" width="1920" height="1080"',
  )
  .replace("<path", '<rect width="360" height="250" fill="#F4F6F8"/><path');
for (const nombre of ["hero-contenedor", "bodega-tarimas", "operador-carga"])
  await sharp(Buffer.from(foto))
    .resize(1920, 1080)
    .webp({ quality: 80 })
    .toFile(`public/img/${nombre}.webp`);
console.log("SVG, iconos PWA y placeholders WebP generados");
