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
import { nearbyPlaces, PLACE_CATEGORIES } from "./services/places";
import { sampleElevation } from "./services/elevation";
import { solveRoute, type RouteResult } from "./services/routing";

let currentSceneView: SceneView | null = null;
let miniViews: MapView[] = [];

function destroyAllViews() {
  currentSceneView?.destroy();
  currentSceneView = null;
  miniViews.forEach((v) => v.destroy());
  miniViews = [];
}

export function renderApp(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="search-bar">
        <calcite-input id="address-input" placeholder="Enter an address" style="width: 420px"></calcite-input>
        <calcite-button id="search-btn">Search</calcite-button>
      </div>
      <div id="results"></div>
    </div>
  `;

  const input = root.querySelector("#address-input") as any;
  const button = root.querySelector("#search-btn") as HTMLElement;
  const results = root.querySelector("#results") as HTMLDivElement;

  button.addEventListener("click", () => runSearch(input.value, results));
}

// Bump this whenever the bundle shape changes -- old cache entries under a
// different version are ignored instead of rendering with stale/missing
// fields (e.g. the enrichment field names changed entirely this round).
const CACHE_VERSION = "v3";

async function runSearch(addressText: string, results: HTMLDivElement) {
  if (!addressText) return;

  const cacheKey = `address-insights:${CACHE_VERSION}:${addressText.toLowerCase().trim()}`;
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

    // Sample destination ~2-3km NE of the address -- a stand-in until
    // Places is authorized, at which point this should route to a real
    // result (e.g. coffeeShops[0]) instead.
    const destX = geocoded.location.x + 0.02;
    const destY = geocoded.location.y + 0.015;

    const [elevationResult, ringResult, enrichmentResult, placesResult, routeResult] = await Promise.allSettled([
      sampleElevation(geocoded.location.x, geocoded.location.y),
      sampleElevationRing(geocoded.location.x, geocoded.location.y),
      enrichPoint(geocoded.location.x, geocoded.location.y),
      nearbyPlaces(geocoded.location.x, geocoded.location.y, PLACE_CATEGORIES.coffeeShops),
      solveRoute(geocoded.location.x, geocoded.location.y, destX, destY),
    ]);

    if (elevationResult.status === "rejected") console.error("Elevation failed:", elevationResult.reason);
    if (enrichmentResult.status === "rejected") console.error("Enrichment failed:", enrichmentResult.reason);
    if (placesResult.status === "rejected") console.error("Places failed:", placesResult.reason);
    if (routeResult.status === "rejected") console.error("Routing failed:", routeResult.reason);

    bundle = {
      address: geocoded.address,
      score: geocoded.score,
      location: geocoded.location,
      rawAttributes: (geocoded.raw as any).attributes ?? {},
      elevation: elevationResult.status === "fulfilled" ? elevationResult.value : null,
      elevationSamples: ringResult.status === "fulfilled" ? ringResult.value : [],
      enrichment: enrichmentResult.status === "fulfilled" ? enrichmentResult.value : null,
      coffeeShops: placesResult.status === "fulfilled" ? placesResult.value : null,
      route: routeResult.status === "fulfilled" ? routeResult.value : null,
      destination: { x: destX, y: destY },
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

function bufferGraphic(x: number, y: number, miles: number) {
  const circle = new Circle({
    center: { x, y, spatialReference: { wkid: 4326 } } as any,
    radius: miles,
    radiusUnit: "miles",
  });
  return new Graphic({
    geometry: circle,
    symbol: { type: "simple-fill", color: [15, 110, 86, 0.15], outline: { color: "#0f6e56", width: 1.5 } } as any,
  });
}

function createMiniMap(container: HTMLDivElement, x: number, y: number, bufferMiles?: number) {
  const layer = new GraphicsLayer();
  if (bufferMiles) layer.add(bufferGraphic(x, y, bufferMiles));
  layer.add(pointGraphic(x, y));

  const view = new MapView({
    container,
    map: new Map({ basemap: "arcgis/streets", layers: [layer] }),
    center: [x, y],
    zoom: bufferMiles ? 13 : 15,
    constraints: { rotationEnabled: false },
    ui: { components: ["attribution"] },
  });
  miniViews.push(view);
  return view;
}

const CONSUMER_STYLES: Record<string, string> = {
  TYPE_A: "High Earning Urban Professionals",
  TYPE_B: "Comfortably Off Empty Nesters",
  TYPE_C: "Modern and Pragmatic Over 50s",
  TYPE_D: "Well Informed Modern Consumers",
  TYPE_E: "Affluent Highly Educated Urban Families",
  TYPE_F: "Security-Oriented Seniors",
  TYPE_G: "Orientation Seeking Lower and Middle Class Consumers",
  TYPE_H: "Younger Lower and Middle Class Consumers",
  TYPE_I: "Modern Younger Families",
  TYPE_J: "Low-Income Younger Consumers",
};

function buildDominantSegment(enrichment: Record<string, any>) {
  const entries = Object.entries(CONSUMER_STYLES)
    .map(([code, label]) => ({ code, label, value: Number(enrichment[code]) || 0 }))
    .sort((a, b) => b.value - a.value);
  const total = entries.reduce((sum, e) => sum + e.value, 0) || 1;
  const top = entries[0];
  const maxVal = top?.value || 1;

  return `
    <div style="font-weight:600">${top.label}</div>
    <div class="ai-card__stat">${((top.value / total) * 100).toFixed(1)}%</div>
    <div class="ai-card__stat-label">Share of Consumer Styles population, 1-mile buffer (Esri India / MBR)</div>
    <div style="margin-top:10px">
      ${entries.map((e) => `
        <div class="spend-bar-row">
          <span class="spend-bar-row__label" style="width:34px" title="${e.label}">${e.code.replace("TYPE_", "")}</span>
          <div class="spend-bar-row__track"><div class="spend-bar-row__fill" style="width:${(e.value / maxVal) * 100}%"></div></div>
          <span class="spend-bar-row__value">${((e.value / total) * 100).toFixed(0)}%</span>
        </div>
      `).join("")}
    </div>
  `;
}

function buildAgePyramid(enrichment: Record<string, any>) {
  const brackets = [
    { label: "60+", m: enrichment.MAGE05_CY || 0, f: enrichment.FAGE05_CY || 0 },
    { label: "45–59", m: enrichment.MAGE04_CY || 0, f: enrichment.FAGE04_CY || 0 },
    { label: "30–44", m: enrichment.MAGE03_CY || 0, f: enrichment.FAGE03_CY || 0 },
    { label: "15–29", m: enrichment.MAGE02_CY || 0, f: enrichment.FAGE02_CY || 0 },
    { label: "0–14", m: enrichment.MAGE01_CY || 0, f: enrichment.FAGE01_CY || 0 },
  ];
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

async function renderResults(root: HTMLDivElement, data: any) {
  destroyAllViews();

  const { address, score, location, rawAttributes, elevation, elevationSamples, enrichment, route: routeData, destination } = data as {
    address: string; score: number; location: { x: number; y: number }; rawAttributes: any;
    elevation: number | null; elevationSamples: number[]; enrichment: Record<string, any> | null;
    route: RouteResult | null; destination: { x: number; y: number };
  };
  const roughness = stdDev(elevationSamples || []);
  const x = location.x, y = location.y;

  root.innerHTML = `
    <div class="result-header">
      <div class="logo-dots"><span></span><span></span><span></span><span></span></div>
      <div>
        <div class="result-title">Esri Address Insights</div>
        <div class="result-subtitle">${address}</div>
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

  // Hero 3D card
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
  const basemapExpand = new Expand({
    view: currentSceneView,
    content: basemapGallery,
    expandIcon: "basemap",
    expandTooltip: "Change basemap",
  });
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

  const coffeeCard = addCard("teal", "Coffee shops nearby", data.coffeeShops != null
    ? `<div class="ai-card__stat">${data.coffeeShops.length}</div><div class="ai-card__stat-label">Within search radius</div><div class="ai-card__minimap"></div>`
    : `<div class="ai-card__stat-label">Unavailable — check the Places privilege on your API key.</div><div class="ai-card__minimap"></div>`);
  createMiniMap(coffeeCard.querySelector(".ai-card__minimap")!, x, y);

  const parkingCard = addCard("teal", "Parking lots nearby", `
    <div class="ai-card__stat">${fakeInt(8, 30)}</div>
    <div class="ai-card__stat-label">Placeholder — wire up a parking category ID</div>
    <div class="ai-card__minimap"></div>
  `);
  createMiniMap(parkingCard.querySelector(".ai-card__minimap")!, x, y);

  const urgentCard = addCard("teal", "Urgent cares found", `
    <div class="ai-card__stat">${fakeInt(3, 20)}</div>
    <div class="ai-card__stat-label">Placeholder — wire up an urgent-care category ID</div>
    <div class="ai-card__minimap"></div>
  `);
  createMiniMap(urgentCard.querySelector(".ai-card__minimap")!, x, y);

  // Real routing card
  const routeCard = addCard("teal", "Sample route", `<div class="ai-card__minimap"></div><div class="ai-card__label" id="route-info" style="margin-top:8px">—</div>`);
  const routeMinimapDiv = routeCard.querySelector(".ai-card__minimap") as HTMLDivElement;
  const routeInfoDiv = routeCard.querySelector("#route-info") as HTMLDivElement;

  if (routeData && routeData.paths.length) {
    const routeLayer = new GraphicsLayer();
    routeLayer.add(new Graphic({
      geometry: { type: "polyline", paths: routeData.paths, spatialReference: { wkid: 4326 } } as any,
      symbol: { type: "simple-line", color: "#0f6e56", width: 3 } as any,
    }));
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
      ${routeData.distanceKm != null ? routeData.distanceKm.toFixed(1) + " km" : "—"} ·
      ${routeData.minutes != null ? Math.round(routeData.minutes) + " min" : "—"}
      <br><span style="color:#999">Sample destination — swap in a real one (e.g. a Places result) once Places is authorized.</span>
    `;
  } else {
    routeInfoDiv.textContent = "Route unavailable — check the Routing privilege on your API key.";
  }

  addCard("green", "Walkability", `
    <div class="ai-card__stat" style="font-size:20px">Fair</div>
    <div class="ai-card__row"><span>Slope</span><b>Fair</b></div>
    <div class="ai-card__row"><span>Distance</span><b>Fair</b></div>
    <div class="ai-card__row"><span>POI coverage</span><b>Fair</b></div>
    <div class="ai-card__label" style="margin-top:8px">Placeholder — combine slope + POI coverage for a real score</div>
  `);

  addCard("green", "Marital status", fakeDonutLegend([
    ["Married", "#0f6e56"], ["Never married", "#5dcaa5"], ["Widowed", "#b6771a"], ["Divorced", "#d85a30"],
  ]));

  addCard("pink", "Trust social media the most", fakeSurveyBar());
  addCard("pink", "Buying American matters", fakeSurveyBar());
  addCard("pink", "I am careful with my money", fakeSurveyBar());
  addCard("pink", "Hate going to my bank", fakeSurveyBar());

  const demoCard = addCard("teal", "Demographics analysis area", `<div class="ai-card__minimap"></div><div class="ai-card__label" style="margin-top:8px">1-mile buffer used for the enrichment cards below</div>`);
  createMiniMap(demoCard.querySelector(".ai-card__minimap")!, x, y, 1);

  addCard("purple", "Dominant segment", enrichment
    ? buildDominantSegment(enrichment)
    : `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);

  const popCard = addCard("teal", "Nearby population", enrichment
    ? `
      <div class="stat-grid">
        <div><div class="ai-card__stat" style="font-size:20px">${formatInt(enrichment.TOTPOP_CY ?? 0)}</div><div class="ai-card__stat-label">Total</div></div>
        <div><div class="ai-card__stat" style="font-size:20px">${formatInt(enrichment.MALES_CY ?? 0)}</div><div class="ai-card__stat-label">Male</div></div>
        <div><div class="ai-card__stat" style="font-size:20px">${formatInt(enrichment.FEMALES_CY ?? 0)}</div><div class="ai-card__stat-label">Female</div></div>
        <div><div class="ai-card__stat" style="font-size:20px">${enrichment.POPDENS_CY?.toFixed(0) ?? "—"}</div><div class="ai-card__stat-label">Per km²</div></div>
      </div>
      <div class="ai-card__minimap"></div>
    `
    : `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);
  const popMinimap = popCard.querySelector(".ai-card__minimap");
  if (popMinimap) createMiniMap(popMinimap as HTMLDivElement, x, y, 1);

  addCard("teal", "Purchasing power", enrichment
    ? `
      <div class="ai-card__stat">₹${formatCompact(enrichment.PP_CY ?? 0)}</div>
      <div class="ai-card__stat-label">Total, 1-mile buffer (assumed INR — India-specific collection, verify against account docs)</div>
      <div class="ai-card__row" style="margin-top:8px"><span>Per capita</span><b>₹${formatInt(enrichment.PPPC_CY ?? 0)}</b></div>
      <div class="ai-card__row"><span>Index vs. national avg.</span><b>${enrichment.PPIDX_CY ?? "—"}</b></div>
      <div class="ai-card__row"><span>Total consumer spending (CS01)</span><b>₹${formatCompact(enrichment.CS01_CY ?? 0)}</b></div>
    `
    : `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);

  addCard("teal", "Mobile carrier share", fakeDonutLegend([
    ["Jio", "#0f6e56"], ["Airtel", "#5dcaa5"], ["Vi", "#b6771a"], ["BSNL", "#d85a30"],
  ]));

  addCard("teal", "Population by age and sex", enrichment
    ? buildAgePyramid(enrichment)
    : `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);

  addCard("teal", "Geocoding response", `<pre class="ai-card__json">${JSON.stringify(rawAttributes, null, 2)}</pre>`);
}

function fakeInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fakeSurveyBar() {
  const a = fakeInt(10, 30), b = fakeInt(10, 30), c = fakeInt(10, 30);
  const d = Math.max(5, 100 - a - b - c);
  return `
    <div class="survey-bar">
      <div style="width:${a}%;background:#26215c"></div>
      <div style="width:${b}%;background:#7f77dd"></div>
      <div style="width:${c}%;background:#378add"></div>
      <div style="width:${d}%;background:#1d9e75"></div>
    </div>
    <div class="ai-card__label" style="margin-top:6px">Placeholder — not a real survey dataset</div>
  `;
}

function fakeDonutLegend(items: [string, string][]) {
  return `
    <div class="fake-legend">
      ${items.map(([label, color]) => `<div class="fake-legend__row"><span class="fake-legend__swatch" style="background:${color}"></span>${label} — ${fakeInt(10, 50)}%</div>`).join("")}
    </div>
    <div class="ai-card__label" style="margin-top:8px">Placeholder — not a real dataset</div>
  `;
}