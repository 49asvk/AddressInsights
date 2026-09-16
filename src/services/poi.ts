import Query from "@arcgis/core/rest/support/Query";
import * as query from "@arcgis/core/rest/query";
import type { Catchment } from "./catchment";

export const POI_LAYER_URL = "https://services8.arcgis.com/S3JihvJw7nZLbh8R/arcgis/rest/services/IndiaBA_POIs/FeatureServer/0";

const CATEGORY_FIELD = "ESRI_IND_1";

export interface PoiResult {
  name: string;
  category: string;
  x: number;
  y: number;
}

let categoriesPromise: Promise<string[]> | null = null;

export function fetchPoiCategories(): Promise<string[]> {
  if (!categoriesPromise) {
    categoriesPromise = (async () => {
      const q = new Query({
        where: `${CATEGORY_FIELD} IS NOT NULL`,
        outFields: [CATEGORY_FIELD],
        returnDistinctValues: true,
        returnGeometry: false,
        orderByFields: [CATEGORY_FIELD],
      });
      const result = await query.executeQueryJSON(POI_LAYER_URL, q);
      return result.features.map((f) => f.attributes[CATEGORY_FIELD] as string).filter(Boolean);
    })().catch((err) => {
      console.error("Failed to fetch POI categories -- check POI_LAYER_URL and item access on the API key:", err);
      return [];
    });
  }
  return categoriesPromise;
}

export async function queryNearbyPois(
  x: number,
  y: number,
  category: string,
  catchment: Catchment
): Promise<PoiResult[]> {
  // The polygon branch was missing `type: "polygon"` -- without it the
  // geometry literal fails autocast and Query.geometry never actually
  // gets set, so the spatial filter silently vanishes and every category
  // query returns up to maxRecordCount (2000) rows with no location
  // constraint at all. That's the fix here.
  const geometryParams =
    catchment.kind === "polygon"
      ? {
          geometry: { type: "polygon", rings: catchment.rings, spatialReference: { wkid: 4326 } } as any,
          spatialRelationship: "intersects" as const,
        }
      : {
          geometry: { type: "point", x, y, spatialReference: { wkid: 4326 } } as any,
          distance: catchment.km * 1000,
          units: "meters" as const,
          spatialRelationship: "intersects" as const,
        };

  const q = new Query({
    ...geometryParams,
    where: `${CATEGORY_FIELD} = '${category.replace(/'/g, "''")}'`,
    outFields: ["NAME", CATEGORY_FIELD],
    returnGeometry: true,
    outSpatialReference: { wkid: 4326 } as any,
  });

  const result = await query.executeQueryJSON(POI_LAYER_URL, q);

  return result.features
    .map((f) => {
      const pt = f.geometry as __esri.Point;
      return { name: (f.attributes.NAME as string) || category, category, x: pt?.x, y: pt?.y };
    })
    .filter((p): p is PoiResult => p.x != null && p.y != null);
}