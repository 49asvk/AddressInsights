import { ARCGIS_API_KEY } from "../config";
import type { Catchment } from "./catchment";

const ENRICH_URL =
  "https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/GeoEnrichment/enrich";

export async function enrichPoint(x: number, y: number, variableKeys: string[], catchment: Catchment) {
  if (variableKeys.length === 0) return null;

  const studyArea =
    catchment.kind === "polygon"
      ? {
          geometry: { rings: catchment.rings, spatialReference: { wkid: 4326 } },
          attributes: { id: "1" },
        }
      : {
          geometry: { x, y },
          attributes: { id: "1" },
          areaType: "RingBuffer",
          bufferUnits: "esriKilometers",
          bufferRadii: [catchment.km],
        };

  const params = new URLSearchParams({
    f: "json",
    token: ARCGIS_API_KEY,
    studyAreas: JSON.stringify([studyArea]),
    analysisVariables: JSON.stringify(variableKeys),
    sourceCountry: "IN",
  });

  const res = await fetch(`${ENRICH_URL}?${params}`);
  const json = await res.json();

  const attributes = json?.results?.[0]?.value?.FeatureSet?.[0]?.features?.[0]?.attributes ?? null;
  if (!attributes) console.error("GeoEnrichment response shape unexpected or errored:", json);
  return attributes;
}