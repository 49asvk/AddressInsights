import { ARCGIS_API_KEY } from "../config";

const ENRICH_URL =
  "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich";

// TOTPOP/TOTHH are confirmed working against this account. Spending is
// requested as a whole collection rather than named variables -- global
// spending variable codes (e.g. "MP07040a") are opaque and country/vintage
// -specific, so pulling the full collection avoids guessing wrong ones
// again and shows whatever your account actually has.
export async function enrichPoint(x: number, y: number, bufferMiles = 1) {
  const studyAreas = [
    {
      geometry: { x, y },
      attributes: { id: "1" },
      areaType: "RingBuffer",
      bufferUnits: "esriMiles",
      bufferRadii: [bufferMiles],
    },
  ];

  const params = new URLSearchParams({
    f: "json",
    token: ARCGIS_API_KEY,
    studyAreas: JSON.stringify(studyAreas),
    analysisVariables: JSON.stringify(["KeyGlobalFacts.TOTPOP", "KeyGlobalFacts.TOTHH"]),
    dataCollections: JSON.stringify(["Spending"]),
  });

  const res = await fetch(`${ENRICH_URL}?${params}`);
  const json = await res.json();

  const attributes = json?.results?.[0]?.value?.FeatureSet?.[0]?.features?.[0]?.attributes ?? null;
  if (!attributes) console.error("GeoEnrichment response shape unexpected or errored:", json);
  return attributes;
}