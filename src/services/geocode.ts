import * as locator from "@arcgis/core/rest/locator";

const WORLD_GEOCODER =
  "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";

export interface GeocodeResult {
  address: string;
  location: { x: number; y: number };
  score: number;
  raw: __esri.AddressCandidate;
}

export async function geocodeAddress(singleLineAddress: string): Promise<GeocodeResult | null> {
  const response = await locator.addressToLocations(WORLD_GEOCODER, {
    address: { SingleLine: singleLineAddress },
    outFields: ["*"],
    maxLocations: 1,
  } as any);

  const best = response[0];
  if (!best) return null;

  return {
    address: best.address,
    location: { x: best.location.x, y: best.location.y },
    score: best.score,
    raw: best,
  };
}

// Wire this up to an <calcite-input> "calciteInputInput" listener for
// live autosuggest, same pattern as the address bar in the original app.
export async function suggestAddress(text: string) {
  return locator.suggestLocations(WORLD_GEOCODER, { text, maxSuggestions: 6 } as any);
}
