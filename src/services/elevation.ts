import ElevationLayer from "@arcgis/core/layers/ElevationLayer";
import Point from "@arcgis/core/geometry/Point";

const worldElevation = new ElevationLayer({
  url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer",
});

export async function sampleElevation(x: number, y: number): Promise<number | null> {
  await worldElevation.load();
  const point = new Point({ x, y, spatialReference: { wkid: 4326 } });
  const result = await worldElevation.queryElevation(point);
  const sampled = (result.geometry as __esri.Point | null)?.z;
  return sampled ?? null;
}

// "Terrain roughness" in the original app is a derived stat, not a raw
// service field -- sample several points in a small ring around (x, y)
// with sampleElevation() above and compute the standard deviation of
// their z-values to reproduce it.
