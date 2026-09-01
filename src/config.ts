// Vite exposes any env var prefixed VITE_ to import.meta.env at build time.
// Put the real value in a local .env file (copy .env.example) -- never
// commit it. See .env.example for exactly what privileges the key needs.
export const ARCGIS_API_KEY = import.meta.env.VITE_ARCGIS_API_KEY as string;

if (!ARCGIS_API_KEY) {
  // Fail loudly in dev rather than silently sending unauthenticated
  // requests that will 403 against every Esri service call below.
  console.error(
    "Missing VITE_ARCGIS_API_KEY. Copy .env.example to .env and add your ArcGIS Location Platform API key."
  );
}
