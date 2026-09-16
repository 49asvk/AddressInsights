import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import Graphic from "@arcgis/core/Graphic";
import * as networkService from "@arcgis/core/rest/networkService";
import { ARCGIS_API_KEY } from "../config";

const SERVICE_AREA_URL =
  "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World";

// Fixed to exactly the two presets this app uses -- no longer user-selectable.
export type TravelModeName = "Walking Time" | "Driving Time";

const travelModeCache = new Map<TravelModeName, any>();

async function getTravelMode(name: TravelModeName) {
  if (travelModeCache.has(name)) return travelModeCache.get(name);
  const description = await networkService.fetchServiceDescription(SERVICE_AREA_URL);
  const mode = description.supportedTravelModes.find((m: any) => m.name === name);
  if (!mode) throw new Error(`Travel mode "${name}" not found in this service's supported modes.`);
  travelModeCache.set(name, mode);
  return mode;
}

export interface ServiceAreaResult {
  rings: number[][][];
}

// breakValue is minutes for both current presets -- the unit follows
// whatever the travel mode's impedance attribute is (time here).
export async function solveServiceAreaCatchment(
  x: number,
  y: number,
  mode: TravelModeName,
  breakValue: number
): Promise<ServiceAreaResult | null> {
  const travelMode = await getTravelMode(mode);

  const facility = new Graphic({
    geometry: { type: "point", x, y, spatialReference: { wkid: 4326 } } as any,
  });

  const params = new ServiceAreaParameters({
    apiKey: ARCGIS_API_KEY,
    facilities: new FeatureSet({ features: [facility] }),
    defaultBreaks: [breakValue],
    travelMode,
    travelDirection: "from-facility",
    outSpatialReference: { wkid: 4326 } as any,
    trimOuterPolygon: true,
  } as any);

  const result = await serviceArea.solve(SERVICE_AREA_URL, params);
  const polygonGraphic = result.serviceAreaPolygons?.features?.[0];
  const geometry = polygonGraphic?.geometry as __esri.Polygon | undefined;
  if (!geometry?.rings) return null;

  return { rings: geometry.rings };
}