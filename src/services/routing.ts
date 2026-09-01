import * as route from "@arcgis/core/rest/route";
import RouteParameters from "@arcgis/core/rest/support/RouteParameters";
import Stop from "@arcgis/core/rest/support/Stop";
import Collection from "@arcgis/core/core/Collection";
import { ARCGIS_API_KEY } from "../config";

const ROUTE_URL = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

export interface RouteResult {
  // Plain coordinate data, not a live Graphic -- Graphics don't survive
  // JSON.stringify/parse correctly, which would silently break the
  // sessionStorage cache path. A fresh Graphic is built from this on
  // every render, cached or not, so the two paths can't diverge.
  paths: number[][][];
  distanceKm: number | null;
  minutes: number | null;
}

export async function solveRoute(
  originX: number,
  originY: number,
  destX: number,
  destY: number
): Promise<RouteResult> {
  const stops = new Collection([
    new Stop({ geometry: { x: originX, y: originY, spatialReference: { wkid: 4326 } } as any }),
    new Stop({ geometry: { x: destX, y: destY, spatialReference: { wkid: 4326 } } as any }),
  ]);

  const params = new RouteParameters({
    apiKey: ARCGIS_API_KEY,
    stops,
    outSpatialReference: { wkid: 4326 } as any,
  } as any);

  const result = await route.solve(ROUTE_URL, params);
  const first = result.routeResults?.[0];
  const geometry = first?.route?.geometry as __esri.Polyline | undefined;
  const attrs = (first?.route?.attributes ?? {}) as any;

  // Field names on the route's attributes are stable for the default
  // travel mode but not guaranteed identical across every mode -- both
  // common variants are checked before giving up.
  const distanceKm = attrs.Total_Kilometers ?? (attrs.Total_Miles != null ? attrs.Total_Miles * 1.60934 : null);
  const minutes = attrs.Total_TravelTime ?? attrs.Total_Minutes ?? null;

  return { paths: geometry?.paths ?? [], distanceKm, minutes };
}