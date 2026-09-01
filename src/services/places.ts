import * as places from "@arcgis/core/rest/places";
import PlacesQueryParameters from "@arcgis/core/rest/support/PlacesQueryParameters";
import Point from "@arcgis/core/geometry/Point";

export async function nearbyPlaces(
  x: number,
  y: number,
  categoryIds: string[],
  radiusMeters = 800
) {
  const point = new Point({ x, y, spatialReference: { wkid: 4326 } });

  const params = new PlacesQueryParameters({
    point,
    radius: radiusMeters,
    categoryIds,
    icon: "png",
  });

  const result = await places.queryPlacesNearPoint(params);
  return result.results;
}

// Confirmed against Esri's docs. Get the other two yourself in one shot:
// https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories?filter=parking&token=YOUR_KEY&f=json
// https://places-api.arcgis.com/arcgis/rest/services/places-service/v1/categories?filter=urgent+care&token=YOUR_KEY&f=json
export const PLACE_CATEGORIES = {
  coffeeShops: ["4bf58dd8d48988d1e0931735"],
  parking: [], // fill in from the /categories?filter=parking lookup above
  urgentCare: [], // fill in from the /categories?filter=urgent+care lookup above
};