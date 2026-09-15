import SceneView from "@arcgis/core/views/SceneView";
import MapView from "@arcgis/core/views/MapView";
import Map from "@arcgis/core/Map";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Circle from "@arcgis/core/geometry/Circle";
import BasemapGallery from "@arcgis/core/widgets/BasemapGallery";
import Expand from "@arcgis/core/widgets/Expand";
import { geocodeAddress } from "./services/geocode";
import { enrichPoint } from "./services/geoenrichment";
import { sampleElevation } from "./services/elevation";
import { solveRoute, type RouteResult } from "./services/routing";
import { fetchPoiCategories, queryNearbyPois, type PoiResult } from "./services/poi";
import { solveServiceAreaCatchment, type TravelModeName } from "./services/serviceArea";
import type { Catchment } from "./services/catchment";
import { ENRICHMENT_COLLECTIONS } from "./data/enrichmentVariables";

let currentSceneView: SceneView | null = null;
let miniViews: MapView[] = [];
let poiCategoryList: string[] = [];

function destroyAllViews() {
  currentSceneView?.destroy();
  currentSceneView = null;
  miniViews.forEach((v) => v.destroy());
  miniViews = [];
}

// --- Pickers --------------------------------------------------------

function buildCatchmentPanel(): string {
  return `
    <calcite-block heading="Catchment area" description="Defines the area used for enrichment and nearby-place searches" collapsible open>
      <div class="catchment-row">
        <label><input type="radio" name="catchment-type" value="ring" checked> Simple buffer</label>
        <label><input type="radio" name="catchment-type" value="service-area"> Service area (street network)</label>
      </div>
      <div class="catchment-row">
        <span class="catchment-row__label">Distance:</span>
        <label><input type="radio" name="catchment-km" value="1" checked> 1 km</label>
        <label><input type="radio" name="catchment-km" value="3"> 3 km</label>
        <label><input type="radio" name="catchment-km" value="5"> 5 km</label>
      </div>
      <div class="catchment-row" id="catchment-mode-row" style="display:none">
        <span class="catchment-row__label">Mode:</span>
        <label><input type="radio" name="catchment-mode" value="Walking Distance" checked> Walking</label>
        <label><input type="radio" name="catchment-mode" value="Driving Distance"> Driving</label>
      </div>
    </calcite-block>
  `;
}

interface CatchmentSelection {
  type: "ring" | "service-area";
  km: number;
  mode: TravelModeName;
}

function getCatchmentSelection(root: HTMLElement): CatchmentSelection {
  const type = ((root.querySelector('input[name="catchment-type"]:checked') as HTMLInputElement)?.value ?? "ring") as "ring" | "service-area";
  const km = Number((root.querySelector('input[name="catchment-km"]:checked') as HTMLInputElement)?.value ?? "1");
  const mode = ((root.querySelector('input[name="catchment-mode"]:checked') as HTMLInputElement)?.value ?? "Walking Distance") as TravelModeName;
  return { type, km, mode };
}

async function resolveCatchment(x: number, y: number, selection: CatchmentSelection): Promise<Catchment> {
  if (selection.type === "ring") return { kind: "ring", km: selection.km };
  try {
    const result = await solveServiceAreaCatchment(x, y, selection.mode, selection.km);
    if (result) return { kind: "polygon", rings: result.rings };
  } catch (err) {
    console.error("Service area solve failed -- check the Routing privilege on your API key:", err);
  }
  console.warn("Falling back to a simple ring buffer for the catchment.");
  return { kind: "ring", km: selection.km };
}

function catchmentLabelFor(selection: CatchmentSelection): string {
  return selection.type === "ring"
    ? `${selection.km} km buffer`
    : `${selection.km} km ${selection.mode.replace(" Distance", "").toLowerCase()} service area`;
}

function buildVariablePanel(): string {
  return `
    <calcite-block heading="Customize data" description="Choose which GeoEnrichment variables to fetch" collapsible open>
      <div class="var-picker-actions">
        <calcite-button appearance="outline" scale="s" id="select-all-vars">Select all</calcite-button>
        <calcite-button appearance="outline" scale="s" id="select-none-vars">Select none</calcite-button>
      </div>
      ${ENRICHMENT_COLLECTIONS.map((c) => `
        <calcite-block heading="${c.label}" collapsible>
          ${c.variables.map((v) => `
            <calcite-label layout="inline" class="var-checkbox-label">
              <calcite-checkbox class="var-checkbox" data-key="${c.collectionId}.${v.id}" checked></calcite-checkbox>
              ${v.label}
            </calcite-label>
          `).join("")}
        </calcite-block>
      `).join("")}
    </calcite-block>
  `;
}

function getSelectedVariableKeys(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<any>(".var-checkbox"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.dataset.key as string);
}

async function buildPoiPicker(container: HTMLElement) {
  container.innerHTML = `<calcite-loader label="Loading POI categories" active scale="s"></calcite-loader>`;
  const categories = await fetchPoiCategories();
  poiCategoryList = categories;
  if (categories.length === 0) {
    container.innerHTML = `<calcite-notice open kind="warning" scale="s"><div slot="message">No POI categories loaded — check POI_LAYER_URL in services/poi.ts, and confirm the API key has item access to this layer.</div></calcite-notice>`;
    return;
  }
  container.innerHTML = `
    <calcite-block heading="Nearby places" description="Choose which categories to fetch from your uploaded POI layer" collapsible open>
      ${categories.map((cat, i) => `
        <calcite-label layout="inline" class="poi-checkbox-label">
          <calcite-checkbox class="poi-checkbox" data-index="${i}"></calcite-checkbox>
          ${cat}
        </calcite-label>
      `).join("")}
    </calcite-block>
  `;
}

function getSelectedPoiCategories(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<any>(".poi-checkbox"))
    .filter((cb) => cb.checked)
    .map((cb) => poiCategoryList[Number(cb.dataset.index)]);
}

// --- App shell --------------------------------------------------------

export function renderApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="search-bar">
        <calcite-input id="address-input" placeholder="Enter an address" style="width: 420px"></calcite-input>
        <calcite-button id="search-btn">Search</calcite-button>
      </div>
      <div class="var-picker">
        ${buildCatchmentPanel()}
        ${buildVariablePanel()}
      </div>
      <div class="poi-picker"></div>
      <div id="results"></div>
    </div>
  `;

  const input = root.querySelector("#address-input") as any;
  const button = root.querySelector("#search-btn") as HTMLElement;
  const results = root.querySelector("#results") as HTMLDivElement;

  root.querySelectorAll('input[name="catchment-type"]').forEach((el) =>
    el.addEventListener("change", () => {
      const modeRow = root.querySelector("#catchment-mode-row") as HTMLElement;
      const type = (root.querySelector('input[name="catchment-type"]:checked') as HTMLInputElement)?.value;
      modeRow.style.display = type === "service-area" ? "" : "none";
    })
  );

  root.querySelector("#select-all-vars")?.addEventListener("click", () => {
    root.querySelectorAll<any>(".var-checkbox").forEach((cb) => (cb.checked = true));
  });
  root.querySelector("#select-none-vars")?.addEventListener("click", () => {
    root.querySelectorAll<any>(".var-checkbox").forEach((cb) => (cb.checked = false));
  });

  buildPoiPicker(root.querySelector(".poi-picker") as HTMLElement);

  button.addEventListener("click", () => {
    const variableKeys = getSelectedVariableKeys(root);
    const poiCategories = getSelectedPoiCategories(root);
    const catchmentSelection = getCatchmentSelection(root);
    runSearch(input.value, results, variableKeys, poiCategories, catchmentSelection);
  });
}

const CACHE_VERSION = "v6";

async function runSearch(
  addressText: string,
  results: HTMLDivElement,
  variableKeys: string[],
  poiCategories: string[],
  catchmentSelection: CatchmentSelection
) {
  if (!addressText) return;

  const signature = `${[...variableKeys].sort().join(",")}|${[...poiCategories].sort().join(",")}|${catchmentSelection.type}:${catchmentSelection.km}:${catchmentSelection.mode}`;
  const cacheKey = `address-insights:${CACHE_VERSION}:${addressText.toLowerCase().trim()}:${signature}`;
  const cached = sessionStorage.getItem(cacheKey);

  results.innerHTML = `<calcite-loader label="Looking up address" active></calcite-loader>`;

  let bundle: any = null;

  if (cached) {
    bundle = JSON.parse(cached);
    if (!bundle?.location) {
      console.warn("Cached entry missing expected shape, re-fetching.");
      bundle = null;
    }
  }

  if (!bundle) {
    const geocoded = await geocodeAddress(addressText);
    if (!geocoded) {
      results.innerHTML = `<calcite-notice open kind="danger"><div slot="message">No match found for that address.</div></calcite-notice>`;
      return;
    }

    const catchment = await resolveCatchment(geocoded.location.x, geocoded.location.y, catchmentSelection);
    const catchmentLabel = catchmentLabelFor(catchmentSelection);

    const destX = geocoded.location.x + 0.02;
    const destY = geocoded.location.y + 0.015;

    const [otherResults, poiSettled] = await Promise.all([
      Promise.allSettled([
        sampleElevation(geocoded.location.x, geocoded.location.y),
        sampleElevationRing(geocoded.location.x, geocoded.location.y),
        enrichPoint(geocoded.location.x, geocoded.location.y, variableKeys, catchment),
      ]),
      Promise.allSettled(poiCategories.map((cat) => queryNearbyPois(geocoded.location.x, geocoded.location.y, cat, catchment))),
    ]);

    const [elevationResult, ringResult, enrichmentResult] = otherResults;
    if (elevationResult.status === "rejected") console.error("Elevation failed:", elevationResult.reason);
    if (enrichmentResult.status === "rejected") console.error("Enrichment failed:", enrichmentResult.reason);

    const poiByCategory: Record<string, PoiResult[]> = {};
    poiCategories.forEach((cat, i) => {
      const r = poiSettled[i];
      if (r.status === "fulfilled") poiByCategory[cat] = r.value;
      else {
        console.error(`POI query failed for "${cat}":`, r.reason);
        poiByCategory[cat] = [];
      }
    });

    const allPois = Object.values(poiByCategory).flat();
    let routeDestX = destX;
    let routeDestY = destY;
    let destLabel = "Sample destination (no POI selected/found)";

    if (allPois.length > 0) {
      const nearest = allPois.reduce((best, p) => {
        const d = (p.x - geocoded.location.x) ** 2 + (p.y - geocoded.location.y) ** 2;
        const bd = (best.x - geocoded.location.x) ** 2 + (best.y - geocoded.location.y) ** 2;
        return d < bd ? p : best;
      });
      routeDestX = nearest.x;
      routeDestY = nearest.y;
      destLabel = `${nearest.name} (${nearest.category})`;
    }
    console.log(`[route] destination chosen: ${destLabel} at (${routeDestX}, ${routeDestY})`);

    const routeResult = await solveRoute(geocoded.location.x, geocoded.location.y, routeDestX, routeDestY).catch((err) => {
      console.error("Routing failed:", err);
      return null;
    });

    bundle = {
      address: geocoded.address,
      score: geocoded.score,
      location: geocoded.location,
      rawAttributes: (geocoded.raw as any).attributes ?? {},
      elevation: elevationResult.status === "fulfilled" ? elevationResult.value : null,
      elevationSamples: ringResult.status === "fulfilled" ? ringResult.value : [],
      enrichment: enrichmentResult.status === "fulfilled" ? enrichmentResult.value : null,
      poiByCategory,
      route: routeResult,
      destination: { x: routeDestX, y: routeDestY, label: destLabel },
      catchment,
      catchmentLabel,
    };

    sessionStorage.setItem(cacheKey, JSON.stringify(bundle));
  }

  await renderResults(results, bundle);
}

async function sampleElevationRing(x: number, y: number) {
  const offsets: [number, number][] = [[0.0015, 0], [-0.0015, 0], [0, 0.0015], [0, -0.0015]];
  const samples = await Promise.all(offsets.map(([dx, dy]) => sampleElevation(x + dx, y + dy)));
  return samples.filter((v): v is number => v != null);
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function formatCompact(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatInt(n: number) {
  return new Intl.NumberFormat().format(Math.round(n));
}

function pointGraphic(x: number, y: number, color = "#d85a30") {
  return new Graphic({
    geometry: { type: "point", x, y, spatialReference: { wkid: 4326 } } as any,
    symbol: { type: "simple-marker", color, outline: { color: "#ffffff", width: 1 }, size: 10 } as any,
  });
}

function catchmentGraphic(x: number, y: number, catchment: Catchment) {
  if (catchment.kind === "ring") {
    const circle = new Circle({
      center: { x, y, spatialReference: { wkid: 4326 } } as any,
      radius: catchment.km,
      radiusUnit: "kilometers",
    });
    return new Graphic({ geometry: circle, symbol: { type: "simple-fill", color: [15, 110, 86, 0.15], outline: { color: "#0f6e56", width: 1.5 } } as any });
  }
  return new Graphic({
    geometry: { type: "polygon", rings: catchment.rings, spatialReference: { wkid: 4326 } } as any,
    symbol: { type: "simple-fill", color: [15, 110, 86, 0.15], outline: { color: "#0f6e56", width: 1.5 } } as any,
  });
}

// Awaited by every caller -- constructing several MapViews' WebGL
// contexts in the same synchronous tick (no awaiting between them) has
// already caused silently-blank maps once in this build; this stays
// sequential on purpose.
async function createMiniMap(container: HTMLDivElement, x: number, y: number, catchment?: Catchment) {
  const layer = new GraphicsLayer();
  if (catchment) layer.add(catchmentGraphic(x, y, catchment));
  layer.add(pointGraphic(x, y));

  const view = new MapView({
    container,
    map: new Map({ basemap: "arcgis/streets", layers: [layer] }),
    center: [x, y],
    zoom: 15,
    constraints: { rotationEnabled: false },
    ui: { components: ["attribution"] },
  });
  miniViews.push(view);
  await view.when();
  if (catchment) await view.goTo(layer.graphics.toArray(), { animate: false });
  return view;
}

async function createPoiMiniMap(container: HTMLDivElement, x: number, y: number, pois: { x: number; y: number }[], catchment: Catchment) {
  const layer = new GraphicsLayer();
  layer.add(catchmentGraphic(x, y, catchment));
  layer.add(pointGraphic(x, y, "#0f6e56"));
  pois.forEach((p) => layer.add(pointGraphic(p.x, p.y, "#378add")));

  const view = new MapView({
    container,
    map: new Map({ basemap: "arcgis/streets", layers: [layer] }),
    constraints: { rotationEnabled: false },
    ui: { components: ["attribution"] },
  });
  miniViews.push(view);
  await view.when();
  await view.goTo(layer.graphics.toArray(), { animate: false });
  return view;
}

// --- Enrichment card builders -------------------------------------------

const consumerStylesLabels = Object.fromEntries(
  (ENRICHMENT_COLLECTIONS.find((c) => c.collectionId === "ConsumerStylesEsriIndia")?.variables ?? []).map((v) => [v.id, v.label])
);

const CURATED_FIELDS = new Set([
  "TOTPOP_CY", "MALES_CY", "FEMALES_CY", "POPDENS_CY",
  "PP_CY", "PPPC_CY", "PPIDX_CY",
  "MAGE01_CY", "MAGE02_CY", "MAGE03_CY", "MAGE04_CY", "MAGE05_CY",
  "FAGE01_CY", "FAGE02_CY", "FAGE03_CY", "FAGE04_CY", "FAGE05_CY",
]);

const ALL_VARIABLE_UNITS: Record<string, "currency" | undefined> = Object.fromEntries(
  ENRICHMENT_COLLECTIONS.flatMap((c) => c.variables.map((v) => [v.id, v.unit]))
);

const META_FIELDS = new Set([
  "OBJECTID", "ID", "HasData", "aggregationMethod", "sourceCountry",
  "ID_0", "id", "areaType", "bufferUnits", "bufferUnitsAlias", "bufferRadii",
  "populationToPolygonSizeRating", "apportionmentConfidence",
]);

const ALL_VARIABLE_LABELS: Record<string, string> = Object.fromEntries(
  ENRICHMENT_COLLECTIONS.flatMap((c) => c.variables.map((v) => [v.id, v.label]))
);

function buildNearbyPopulation(enrichment: Record<string, any>): string | null {
  const stats: { label: string; value: string }[] = [];
  if ("TOTPOP_CY" in enrichment) stats.push({ label: "Total", value: formatInt(enrichment.TOTPOP_CY) });
  if ("MALES_CY" in enrichment) stats.push({ label: "Male", value: formatInt(enrichment.MALES_CY) });
  if ("FEMALES_CY" in enrichment) stats.push({ label: "Female", value: formatInt(enrichment.FEMALES_CY) });
  if ("POPDENS_CY" in enrichment) stats.push({ label: "Per km²", value: Number(enrichment.POPDENS_CY).toFixed(0) });
  if (stats.length === 0) return null;
  return `
    <div class="stat-grid">
      ${stats.map((s) => `<div><div class="ai-card__stat" style="font-size:20px">${s.value}</div><div class="ai-card__stat-label">${s.label}</div></div>`).join("")}
    </div>
    <div class="ai-card__minimap"></div>
  `;
}

function buildPurchasingPower(enrichment: Record<string, any>): string | null {
  let hero = "";
  const rows: string[] = [];
  if ("PP_CY" in enrichment) hero = `<div class="ai-card__stat">₹${formatCompact(enrichment.PP_CY)}</div><div class="ai-card__stat-label">Total, selected catchment (assumed INR — verify against account docs)</div>`;
  if ("PPPC_CY" in enrichment) rows.push(`<div class="ai-card__row"><span>Per capita</span><b>₹${formatInt(enrichment.PPPC_CY)}</b></div>`);
  if ("PPIDX_CY" in enrichment) rows.push(`<div class="ai-card__row"><span>Index vs. national avg.</span><b>${enrichment.PPIDX_CY}</b></div>`);
  if (!hero && rows.length === 0) return null;
  return `${hero}${rows.join("")}`;
}

function buildAgePyramid(enrichment: Record<string, any>): string | null {
  const brackets = [
    { label: "60+", mKey: "MAGE05_CY", fKey: "FAGE05_CY" },
    { label: "45–59", mKey: "MAGE04_CY", fKey: "FAGE04_CY" },
    { label: "30–44", mKey: "MAGE03_CY", fKey: "FAGE03_CY" },
    { label: "15–29", mKey: "MAGE02_CY", fKey: "FAGE02_CY" },
    { label: "0–14", mKey: "MAGE01_CY", fKey: "FAGE01_CY" },
  ]
    .map((b) => ({ label: b.label, m: enrichment[b.mKey] || 0, f: enrichment[b.fKey] || 0, present: b.mKey in enrichment || b.fKey in enrichment }))
    .filter((b) => b.present);
  if (brackets.length === 0) return null;
  const max = Math.max(...brackets.flatMap((b) => [b.m, b.f]), 1);
  return `
    <div class="pyramid-legend"><span class="pyramid-swatch pyramid-swatch--m"></span>Male<span class="pyramid-swatch pyramid-swatch--f" style="margin-left:14px"></span>Female</div>
    ${brackets.map((b) => `
      <div class="pyramid-row">
        <div class="pyramid-row__side pyramid-row__side--m"><div class="pyramid-row__fill pyramid-row__fill--m" style="width:${(b.m / max) * 100}%"></div></div>
        <div class="pyramid-row__label">${b.label}</div>
        <div class="pyramid-row__side pyramid-row__side--f"><div class="pyramid-row__fill pyramid-row__fill--f" style="width:${(b.f / max) * 100}%"></div></div>
      </div>
    `).join("")}
  `;
}

const DONUT_COLORS = ["#0f6e56", "#5dcaa5", "#378add", "#b6771a", "#d85a30", "#6b4fbb", "#99355a", "#2f7d32", "#26215c", "#7f77dd"];

function buildConsumerStylesDonut(enrichment: Record<string, any>): string | null {
  const codes = Object.keys(consumerStylesLabels).filter((c) => c in enrichment);
  if (codes.length < 2) return null;
  const entries = codes
    .map((c) => ({ code: c, label: consumerStylesLabels[c], value: Number(enrichment[c]) || 0 }))
    .sort((a, b) => b.value - a.value);
  const total = entries.reduce((s, e) => s + e.value, 0) || 1;

  let cumulative = 0;
  const stops = entries
    .map((e, i) => {
      const startPct = (cumulative / total) * 100;
      cumulative += e.value;
      const endPct = (cumulative / total) * 100;
      return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${startPct}% ${endPct}%`;
    })
    .join(", ");

  return `
    <div class="donut-chart" style="background: conic-gradient(${stops});"></div>
    <div class="donut-legend">
      ${entries.map((e, i) => `<div class="donut-legend__row"><span class="donut-legend__swatch" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>${e.label} — ${((e.value / total) * 100).toFixed(0)}%</div>`).join("")}
    </div>
  `;
}

function buildLeftoverStatCards(enrichment: Record<string, any>): { title: string; body: string }[] {
  const consumerStyleKeys = new Set(Object.keys(consumerStylesLabels));
  return Object.keys(enrichment)
    .filter((k) => !CURATED_FIELDS.has(k) && !META_FIELDS.has(k) && !consumerStyleKeys.has(k))
    .map((k) => {
      const raw = enrichment[k];
      const isCurrency = ALL_VARIABLE_UNITS[k] === "currency";
      const value = typeof raw === "number" ? (isCurrency ? `₹${formatCompact(raw)}` : formatCompact(raw)) : raw;
      return { title: ALL_VARIABLE_LABELS[k] ?? k, body: `<div class="ai-card__stat">${value}</div>` };
    });
}

// -------------------------------------------------------------------------

async function renderResults(root: HTMLDivElement, data: any) {
  destroyAllViews();

  const { address, score, location, rawAttributes, elevation, elevationSamples, enrichment, poiByCategory, route: routeData, destination, catchment, catchmentLabel } = data as {
    address: string; score: number; location: { x: number; y: number }; rawAttributes: any;
    elevation: number | null; elevationSamples: number[]; enrichment: Record<string, any> | null;
    poiByCategory: Record<string, PoiResult[]>; route: RouteResult | null;
    destination: { x: number; y: number; label: string }; catchment: Catchment; catchmentLabel: string;
  };
  const roughness = stdDev(elevationSamples || []);
  const x = location.x, y = location.y;

  root.innerHTML = `
    <div class="result-header">
      <div class="logo-dots"><span></span><span></span><span></span><span></span></div>
      <div>
        <div class="result-title">Esri Address Insights</div>
        <div class="result-subtitle">${address} · ${catchmentLabel}</div>
      </div>
    </div>
    <div class="card-grid" id="card-grid"></div>
  `;

  const grid = root.querySelector("#card-grid") as HTMLDivElement;

  function addCard(kind: string, title: string, bodyHtml: string) {
    const card = document.createElement("div");
    card.className = "ai-card";
    card.dataset.kind = kind;
    card.innerHTML = `<div class="ai-card__header">${title}</div><div class="ai-card__body">${bodyHtml}</div>`;
    grid.appendChild(card);
    return card;
  }

  const sceneCard = document.createElement("div");
  sceneCard.className = "ai-card ai-card--scene";
  sceneCard.dataset.kind = "teal";
  sceneCard.innerHTML = `<div class="ai-card__header">${rawAttributes.PlaceName || address}</div><div class="ai-card__scene"></div>`;
  grid.appendChild(sceneCard);

  const sceneDiv = sceneCard.querySelector(".ai-card__scene") as HTMLDivElement;
  const sceneLayer = new GraphicsLayer();
  sceneLayer.add(pointGraphic(x, y));
  currentSceneView = new SceneView({
    container: sceneDiv,
    map: new Map({ basemap: "arcgis/topographic", ground: "world-elevation", layers: [sceneLayer] }),
    center: [x, y],
    zoom: 17,
    ui: { components: ["attribution"] },
  });
  await currentSceneView.when();
  currentSceneView.goTo({ tilt: 45 }, { animate: false });

  const basemapGallery = new BasemapGallery({ view: currentSceneView });
  const basemapExpand = new Expand({ view: currentSceneView, content: basemapGallery, expandIcon: "basemap", expandTooltip: "Change basemap" });
  currentSceneView.ui.add(basemapExpand, "top-right");

  addCard("teal", "Match quality", `
    <div class="ai-card__label">Address type</div>
    <div>${rawAttributes.Addr_type ?? "—"}</div>
    <div class="ai-card__stat">${score.toFixed(2)}</div>
    <div class="ai-card__stat-label">Match score</div>
  `);

  addCard("amber", "Elevation", elevation != null
    ? `<div class="ai-card__stat">${elevation.toFixed(1)} m</div><div class="ai-card__stat-label">Above sea level</div>`
    : `<div class="ai-card__stat-label">Unavailable — check the Elevation privilege on your API key.</div>`);

  addCard("amber", "Terrain roughness", `
    <div class="ai-card__stat">${roughness.toFixed(2)}</div>
    <div class="ai-card__stat-label">Std. dev. of nearby elevation samples (real, derived)</div>
  `);

  for (const [category, pois] of Object.entries(poiByCategory)) {
    const card = addCard("teal", category, `
      <div class="ai-card__stat">${pois.length}</div>
      <div class="ai-card__stat-label">Within ${catchmentLabel}</div>
      <div class="ai-card__minimap"></div>
    `);
    await createPoiMiniMap(card.querySelector(".ai-card__minimap")!, x, y, pois, catchment);
  }

  const routeCard = addCard("teal", "Route", `<div class="ai-card__minimap"></div><div class="ai-card__label" id="route-info" style="margin-top:8px">—</div>`);
  const routeMinimapDiv = routeCard.querySelector(".ai-card__minimap") as HTMLDivElement;
  const routeInfoDiv = routeCard.querySelector("#route-info") as HTMLDivElement;

  if (routeData && routeData.paths.length) {
    const routeLayer = new GraphicsLayer();
    routeLayer.add(new Graphic({ geometry: { type: "polyline", paths: routeData.paths, spatialReference: { wkid: 4326 } } as any, symbol: { type: "simple-line", color: "#0f6e56", width: 3 } as any }));
    routeLayer.add(pointGraphic(x, y));
    routeLayer.add(pointGraphic(destination.x, destination.y, "#378add"));

    const routeView = new MapView({
      container: routeMinimapDiv,
      map: new Map({ basemap: "arcgis/streets", layers: [routeLayer] }),
      constraints: { rotationEnabled: false },
      ui: { components: ["attribution"] },
    });
    miniViews.push(routeView);
    await routeView.when();
    await routeView.goTo(routeLayer.graphics.toArray(), { animate: false });

    routeInfoDiv.innerHTML = `
      To: <b>${destination.label}</b><br>
      ${routeData.distanceKm != null ? routeData.distanceKm.toFixed(1) + " km" : "—"} ·
      ${routeData.minutes != null ? Math.round(routeData.minutes) + " min" : "—"}
    `;
  } else {
    routeInfoDiv.textContent = "Route unavailable — check the Routing privilege on your API key.";
  }

  const demoCard = addCard("teal", "Demographics analysis area", `<div class="ai-card__minimap"></div><div class="ai-card__label" style="margin-top:8px">${catchmentLabel}, used for the enrichment cards below</div>`);
  await createMiniMap(demoCard.querySelector(".ai-card__minimap")!, x, y, catchment);

  const popHtml = enrichment ? buildNearbyPopulation(enrichment) : null;
  const popCard = addCard("teal", "Nearby population", popHtml ?? `<div class="ai-card__stat-label">No population variables selected, or unavailable — check the Demographics privilege.</div>`);
  const popMinimap = popCard.querySelector(".ai-card__minimap");
  if (popMinimap) await createMiniMap(popMinimap as HTMLDivElement, x, y, catchment);

  const ppHtml = enrichment ? buildPurchasingPower(enrichment) : null;
  addCard("teal", "Purchasing power", ppHtml ?? `<div class="ai-card__stat-label">No purchasing power / spending variables selected, or unavailable.</div>`);

  const pyramidHtml = enrichment ? buildAgePyramid(enrichment) : null;
  addCard("teal", "Population by age and sex", pyramidHtml ?? `<div class="ai-card__stat-label">No age-bracket variables selected, or unavailable.</div>`);

  if (enrichment) {
    const donutHtml = buildConsumerStylesDonut(enrichment);
    if (donutHtml) addCard("purple", "Consumer Styles breakdown", donutHtml);
    buildLeftoverStatCards(enrichment).forEach(({ title, body }) => addCard("teal", title, body));
  }

  addCard("teal", "Geocoding response", `<pre class="ai-card__json">${JSON.stringify(rawAttributes, null, 2)}</pre>`);
}