export const MEDIA_ENABLED = true;
export const MAX_ATTACHMENTS = 8;
export const FILE_LIMIT = 8 * 1024 * 1024;
export const deliveryTypes = {
  xlsx: [
    "spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  xls: ["spreadsheet", "application/vnd.ms-excel"],
  xlsm: ["spreadsheet", "application/vnd.ms-excel.sheet.macroEnabled.12"],
  ods: ["spreadsheet", "application/vnd.oasis.opendocument.spreadsheet"],
  csv: ["spreadsheet", "text/csv; charset=utf-8"],
  docx: [
    "document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  doc: ["document", "application/msword"],
  odt: ["document", "application/vnd.oasis.opendocument.text"],
  pptx: [
    "presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  ppt: ["presentation", "application/vnd.ms-powerpoint"],
  pdf: ["pdf", "application/pdf"],
  html: ["html", "text/html; charset=utf-8"],
  htm: ["html", "text/html; charset=utf-8"],
  txt: ["text", "text/plain; charset=utf-8"],
  md: ["text", "text/markdown; charset=utf-8"],
  json: ["text", "application/json"],
  xml: ["text", "application/xml"],
  zip: ["package", "application/zip"],
};
if (MEDIA_ENABLED)
  Object.assign(deliveryTypes, {
    gif: ["image", "image/gif"],
    heic: ["image", "image/heic"],
    heif: ["image", "image/heif"],
    png: ["image", "image/png"],
    jpg: ["image", "image/jpeg"],
    jpeg: ["image", "image/jpeg"],
    webp: ["image", "image/webp"],
    svg: ["image", "image/svg+xml"],
    mp4: ["video", "video/mp4"],
    webm: ["video", "video/webm"],
    mov: ["video", "video/quicktime"],
    mp3: ["audio", "audio/mpeg"],
    wav: ["audio", "audio/wav"],
    m4a: ["audio", "audio/mp4"],
    ogg: ["audio", "audio/ogg"],
  });
export const uploadExtensions = Object.keys(deliveryTypes).filter(
  (ext) => !["html", "htm", "svg"].includes(ext),
);
export const uploadAccept = uploadExtensions.map((ext) => "." + ext).join(",");
export const deliveryAccept = Object.keys(deliveryTypes)
  .map((ext) => "." + ext)
  .join(",");
