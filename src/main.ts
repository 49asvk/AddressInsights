import esriConfig from "@arcgis/core/config";
import "./style.css";
import { ARCGIS_API_KEY } from "./config";
import { renderApp } from "./app";

// Calcite's web components fetch their icon/font assets from this path
// at runtime. Pointing at the CDN keeps this starter simple -- for a
// real deployment, copy node_modules/@esri/calcite-components/dist/calcite/assets
// into /public and point this at "/assets" instead, so the app doesn't
// depend on js.arcgis.com being reachable in production.

// One key, assigned once here, is what every service call in src/services
// authenticates with -- see config.ts and .env.example for where it comes
// from and what privileges it needs.
esriConfig.apiKey = ARCGIS_API_KEY;

renderApp(document.getElementById("app")!);
