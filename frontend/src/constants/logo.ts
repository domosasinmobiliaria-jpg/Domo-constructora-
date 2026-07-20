// Logo DOMO en base64 (SVG data URI) usado en encabezados y PDFs.
// Sustituir por el logo oficial cuando esté disponible; se mantiene ligero
// para no inflar el bundle.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60">
  <rect width="200" height="60" rx="8" fill="#1A3A6B"/>
  <path d="M18 42 L34 16 L50 42 Z" fill="#F57C00"/>
  <rect x="30" y="34" width="8" height="8" fill="#FFFFFF"/>
  <text x="62" y="32" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF">DOMO</text>
  <text x="62" y="48" font-family="Arial, sans-serif" font-size="10" letter-spacing="1.5" fill="#F57C00">CONSTRUCTORA</text>
</svg>`;

// Data URI listo para usar dentro del HTML de los PDFs. Se usa encodeURIComponent
// en lugar de base64 para no depender de btoa/Buffer (no disponibles en Hermes).
export const LOGO_DATA_URI =
  'data:image/svg+xml;utf8,' + encodeURIComponent(LOGO_SVG);

export default LOGO_DATA_URI;
