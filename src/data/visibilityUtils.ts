// Utilities for building label visibility maps from a labelVisibility measure.

// Aggregates visibility measure values by first category (cat1) indices.
export function buildLabelVisibilityMapForCat1(cat1Values: any[], labelVisibilityValues: any[]): Map<any, number> {
  const map = new Map<any, number>();
  if (!Array.isArray(cat1Values) || !Array.isArray(labelVisibilityValues) || cat1Values.length !== labelVisibilityValues.length) {
    return map;
  }
  const indicesByValue = new Map<any, number[]>();
  for (let i = 0; i < cat1Values.length; i++) {
    const v = cat1Values[i];
    if (!indicesByValue.has(v)) indicesByValue.set(v, []);
    indicesByValue.get(v)!.push(i);
  }
  for (const [val, idxs] of indicesByValue) {
    let sum = 0;
    for (const i of idxs) {
      const vis = labelVisibilityValues[i];
      sum += (vis === null || vis === undefined) ? 0 : Number(vis);
    }
    map.set(val, sum);
  }
  return map;
}
