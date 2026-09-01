# Address Insights (PoC starter)

A minimal Vite + ArcGIS Maps SDK for JavaScript + Calcite Design System
starter, matching the stack behind Esri's internal "Address Insights"
BD tool: type an address, geocode it, fan out to a few Esri services in
parallel, render the results as cards.

This is deliberately small -- one working card per service category
(match quality, elevation, places, GeoEnrichment), a placeholder for
Tapestry, and everything else (routing/"Weekend Warrior", walkability
scoring, the match-narrative debug view, shareable `#/view/{uuid}`
links) left as TODOs for the next pass.

## Where your ArcGIS credentials go

There's exactly one place: **`esriConfig.apiKey`**, set once in
`src/main.ts`, read from `VITE_ARCGIS_API_KEY` in your `.env` file.

1. Copy `.env.example` to `.env`.
2. Generate an API key on your Esri India account at
   [location.arcgis.com](https://location.arcgis.com) (or, in an
   existing org: Content > New item > API key).
3. When creating the key, enable these privileges: **Geocoding**,
   **Places**, **Demographics (GeoEnrichment)**, **Basemaps**,
   **Elevation**.
4. Under the key's Security tab, add `http://localhost:5173` as an
   allowed referrer for local dev.
5. Paste the key value into `.env` as `VITE_ARCGIS_API_KEY=...`.

That single key authenticates every call in `src/services/*` --
geocoding, places, geoenrichment, and the elevation tile service all
check the same key against your org's privileges. `.env` is
gitignored; never commit the real value.

If you'd rather have people sign in with their own org account instead
of a shared key (closer to how a customer-facing internal tool might
work), swap `esriConfig.apiKey` for `esri/identity/IdentityManager` +
OAuth 2.0 -- more setup, not needed for a PoC.

## Running it

```bash
npm install
npm run dev
```

Then open the printed localhost URL, type an address, hit Search.

## The India / Tapestry gap

Tapestry Segmentation is a US/Canada/etc-only product. The "Dominant
segment" card is static placeholder content for that reason -- check
your org's Data Browser for what demographic variables actually have
India coverage (population and household counts are broadly
available; income, spending, and segmentation products vary). Swap
`ANALYSIS_VARIABLES` in `src/services/geoenrichment.ts` once you know
what's licensed.

## Verify against current docs

`esri/rest/places` and `esri/rest/geoenrichment` are newer, faster-
moving parts of the SDK -- their exact call signatures have shifted
across versions. Check
[developers.arcgis.com/javascript/latest](https://developers.arcgis.com/javascript/latest/)
against whatever `@arcgis/core` version lands in `package.json` after
`npm install`, particularly for `places.searchNearby`.

## Next steps (see the earlier build-phase plan)

- Places cards for parking / urgent care (same `nearbyPlaces()` helper,
  different `PLACE_CATEGORIES` + radius)
- Terrain roughness: sample a small ring of points with
  `sampleElevation()` and compute the standard deviation
- Weekend Warrior route: places lookups feeding into the Network
  Analysis Route/VRP REST service
- Walkability score: composite of elevation slope + places coverage
- Match-narrative debug view: `calcite-flow` / `calcite-flow-item` for
  the drill-down, diffing input tokens against the geocode response
- Shareable `#/view/{uuid}` links: small key-value store keyed by UUID
  holding the address + cached responses
