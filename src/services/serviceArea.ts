import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import Graphic from "@arcgis/core/Graphic";
import * as networkService from "@arcgis/core/rest/networkService";
import { ARCGIS_API_KEY } from "../config";

const SERVICE_AREA_URL =
  "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World";

export type TravelModeName = "Walking Distance" | "Driving Distance";

const travelModeCache = new Map<TravelModeName, any>();

async function getTravelMode(name: TravelModeName) {
  if (travelModeCache.has(name)) return travelModeCache.get(name);
  // Relies on the global esriConfig.apiKey set in main.ts -- if this call
  // 403s while everything else works, that's the first thing to check.
  const description = await networkService.fetchServiceDescription(SERVICE_AREA_URL);
  const mode = description.supportedTravelModes.find((m: any) => m.name === name);
  if (!mode) throw new Error(`Travel mode "${name}" not found in this service's supported modes.`);
  travelModeCache.set(name, mode);
  return mode;
}

export interface ServiceAreaResult {
  rings: number[][][];
}

export async function solveServiceAreaCatchment(
  x: number,
  y: number,
  mode: TravelModeName,
  km: number
): Promise<ServiceAreaResult | null> {
  const travelMode = await getTravelMode(mode);

  const facility = new Graphic({
    geometry: { type: "point", x, y, spatialReference: { wkid: 4326 } } as any,
  });

  const params = new ServiceAreaParameters({
    apiKey: ARCGIS_API_KEY,
    facilities: new FeatureSet({ features: [facility] }),
    defaultBreaks: [km],
    travelMode,
    // Area reachable FROM the address, not routes converging on it --
    // "to-facility" (used in Esri's own sample) is for the opposite
    // scenario, e.g. customers reaching a store.
    travelDirection: "from-facility",
    outSpatialReference: { wkid: 4326 } as any,
    trimOuterPolygon: true,
  } as any);

  const result = await serviceArea.solve(SERVICE_AREA_URL, params);
  const polygonGraphic = result.serviceAreaPolygons?.[0];
  const geometry = polygonGraphic?.geometry as __esri.Polygon | undefined;
  if (!geometry?.rings) return null;

  return { rings: geometry.rings };
}