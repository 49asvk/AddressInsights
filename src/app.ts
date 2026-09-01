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

async function runSearch(addressText: string, results: HTMLDivElement) {
  if (!addressText) return;

  // Bump this whenever the bundle shape changes -- old cache entries under
  // a different version are ignored instead of crashing on load.
    const CACHE_VERSION = "v2";
    const cacheKey = `address-insights:${CACHE_VERSION}:${addressText.toLowerCase().trim()}`;
    const cached = sessionStorage.getItem(cacheKey);

  results.innerHTML = `<calcite-loader label="Looking up address" active></calcite-loader>`;

  let bundle: any;

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

    const [elevationResult, ringResult, enrichmentResult, placesResult] = await Promise.allSettled([
      sampleElevation(geocoded.location.x, geocoded.location.y),
      sampleElevationRing(geocoded.location.x, geocoded.location.y),
      enrichPoint(geocoded.location.x, geocoded.location.y),
      nearbyPlaces(geocoded.location.x, geocoded.location.y, PLACE_CATEGORIES.coffeeShops),
    ]);

    if (elevationResult.status === "rejected") console.error("Elevation failed:", elevationResult.reason);
    if (enrichmentResult.status === "rejected") console.error("Enrichment failed:", enrichmentResult.reason);
    if (placesResult.status === "rejected") console.error("Places failed:", placesResult.reason);

    bundle = {
      address: geocoded.address,
      score: geocoded.score,
      location: geocoded.location,
      rawAttributes: (geocoded.raw as any).attributes ?? {},
      elevation: elevationResult.status === "fulfilled" ? elevationResult.value : null,
      elevationSamples: ringResult.status === "fulfilled" ? ringResult.value : [],
      enrichment: enrichmentResult.status === "fulfilled" ? enrichmentResult.value : null,
      coffeeShops: placesResult.status === "fulfilled" ? placesResult.value : null,
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

// CS01 is inferred as the total from its magnitude relative to CS02..CS20,
// not a confirmed field name -- verify against your account's Spending
// data dictionary. IDX = index vs. national average (100 = average) is a
// standard convention across most Esri demographic collections.
function parseSpendingCategories(enrichment: Record<string, any>) {
  const categories: { code: string; cy: number; perCapita: number; index: number }[] = [];
  for (let i = 1; i <= 20; i++) {
    const n = String(i).padStart(2, "0");
    const cy = enrichment[`CS${n}_CY`];
    if (cy == null) continue;
    categories.push({
      code: `CS${n}`,
      cy,
      perCapita: enrichment[`CSPC${n}_CY`],
      index: enrichment[`CS${n}IDX_CY`],
    });
  }
  return categories;
}

function formatCompact(n: number) {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function pointGraphic(x: number, y: number) {
  return new Graphic({
    geometry: { type: "point", x, y, spatialReference: { wkid: 4326 } } as any,
    symbol: { type: "simple-marker", color: "#d85a30", outline: { color: "#ffffff", width: 1 }, size: 10 } as any,
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

async function renderResults(root: HTMLDivElement, data: any) {
  destroyAllViews();

  const { address, score, location, rawAttributes, elevation, elevationSamples, enrichment, coffeeShops } = data;
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

  const coffeeCard = addCard("teal", "Coffee shops nearby", coffeeShops != null
    ? `<div class="ai-card__stat">${coffeeShops.length}</div><div class="ai-card__stat-label">Within search radius</div><div class="ai-card__minimap"></div>`
    : `<div class="ai-card__stat-label">Unavailable — check the Places privilege on your API key.</div><div class="ai-card__minimap"></div>`);
  createMiniMap(coffeeCard.querySelector(".ai-card__minimap")!, x, y);

  const parkingCard = addCard("teal", "Parking lots nearby", `
    <div class="ai-card__stat">${fakeInt(8, 30)}</div>
    <div class="ai-card__stat-label">Placeholder</div>
    <div class="ai-card__minimap"></div>
  `);
  createMiniMap(parkingCard.querySelector(".ai-card__minimap")!, x, y);

  const urgentCard = addCard("teal", "Urgent cares found", `
    <div class="ai-card__stat">${fakeInt(3, 20)}</div>
    <div class="ai-card__stat-label">Placeholder</div>
    <div class="ai-card__minimap"></div>
  `);
  createMiniMap(urgentCard.querySelector(".ai-card__minimap")!, x, y);

  const routeCard = addCard("teal", "Optimized weekend warrior", `
    <div class="ai-card__row"><span>Distance</span><b>${(Math.random() * 3 + 1).toFixed(1)} miles</b></div>
    <div class="ai-card__row"><span>Est. time</span><b>${fakeInt(10, 25)}m</b></div>
    <div class="ai-card__minimap"></div>
    <div class="ai-card__label" style="margin-top:8px">Placeholder route wire up the Network Analysis Route service</div>
  `);
  createMiniMap(routeCard.querySelector(".ai-card__minimap")!, x, y);

  addCard("green", "Walkability", `
    <div class="ai-card__stat" style="font-size:20px">Fair</div>
    <div class="ai-card__row"><span>Slope</span><b>Fair</b></div>
    <div class="ai-card__row"><span>Distance</span><b>Fair</b></div>
    <div class="ai-card__row"><span>POI coverage</span><b>Fair</b></div>
    <div class="ai-card__label" style="margin-top:8px">Placeholder</div>
  `);

  addCard("green", "Marital status", fakeDonutLegend([
    ["Married", "#0f6e56"], ["Never married", "#5dcaa5"], ["Widowed", "#b6771a"], ["Divorced", "#d85a30"],
  ]));

  addCard("pink", "Trust social media the most", fakeSurveyBar());
  addCard("pink", "Buying American matters", fakeSurveyBar());
  addCard("pink", "I am careful with my money", fakeSurveyBar());
  addCard("pink", "Hate going to my bank", fakeSurveyBar());

  const demoCard = addCard("teal", "Demographics analysis area", `<div class="ai-card__minimap"></div><div class="ai-card__label" style="margin-top:8px">1-mile buffer used for the enrichment call below</div>`);
  createMiniMap(demoCard.querySelector(".ai-card__minimap")!, x, y, 1);

  addCard("purple", "Dominant segment", `
    <div style="font-weight:600">Sample segment — placeholder</div>
    <div class="ai-card__stat-label">Tapestry data isn't available on Esri India accounts. Wire up a real segmentation source here if you have one, or remove this card.</div>
  `);

  const popCard = addCard("teal", "Nearby population", enrichment != null
    ? `<div class="ai-card__stat">${enrichment.TOTPOP ?? "—"}</div><div class="ai-card__stat-label">Total population, 1-mile buffer</div><div class="ai-card__minimap"></div>`
    : `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);
  const popMinimap = popCard.querySelector(".ai-card__minimap");
  if (popMinimap) createMiniMap(popMinimap as HTMLDivElement, x, y, 1);

  // Spending cards
  if (enrichment) {
    const categories = parseSpendingCategories(enrichment);
    const total = categories.find((c) => c.code === "CS01");
    const rest = categories.filter((c) => c.code !== "CS01");
    const maxIndex = Math.max(...rest.map((c) => c.index || 0), 1);
    const sortedByIndex = [...rest].sort((a, b) => (b.index || 0) - (a.index || 0));

    addCard("teal", "Total consumer spending", total
      ? `<div class="ai-card__stat">${formatCompact(total.cy)}</div>
         <div class="ai-card__stat-label">CS01, 1-mile buffer — currency units unconfirmed for this account</div>`
      : `<div class="ai-card__stat-label">CS01 field not present in this account's response.</div>`);

    addCard("teal", "Spending index by category", `
      ${sortedByIndex.map((c) => `
        <div class="spend-bar-row">
          <span class="spend-bar-row__label">${c.code}</span>
          <div class="spend-bar-row__track"><div class="spend-bar-row__fill" style="width:${((c.index || 0) / maxIndex) * 100}%"></div></div>
          <span class="spend-bar-row__value">${c.index ?? "—"}</span>
        </div>
      `).join("")}
      <div class="ai-card__label" style="margin-top:8px">Index vs. national average (100 = average). Field codes only — category names unconfirmed, check your Spending data dictionary.</div>
    `);

    addCard("teal", "Spending — full breakdown", `
      <table>
        <thead><tr><th>Field</th><th>CY value</th><th>Per capita</th><th>Index</th></tr></thead>
        <tbody>
          ${categories.map((c) => `<tr><td>${c.code}</td><td>${formatCompact(c.cy)}</td><td>${c.perCapita?.toFixed(2) ?? "—"}</td><td>${c.index ?? "—"}</td></tr>`).join("")}
        </tbody>
      </table>
    `);
  } else {
    addCard("teal", "Consumer spending", `<div class="ai-card__stat-label">Unavailable — check the Demographics (GeoEnrichment) privilege on your API key.</div>`);
  }

  addCard("teal", "Mobile carrier share", fakeDonutLegend([
    ["Jio", "#0f6e56"], ["Airtel", "#5dcaa5"], ["Vi", "#b6771a"], ["BSNL", "#d85a30"],
  ]));

  addCard("teal", "Population by age and sex", `
    <div class="ai-card__label">Placeholder pyramid — wire up a real age/sex breakdown from GeoEnrichment</div>
    <div class="fake-pyramid">
      ${[0, 1, 2, 3, 4, 5].map(() => `<div class="fake-pyramid__row"><div class="fake-pyramid__bar" style="width:${fakeInt(20, 90)}%"></div><div class="fake-pyramid__bar fake-pyramid__bar--r" style="width:${fakeInt(20, 90)}%"></div></div>`).join("")}
    </div>
  `);

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