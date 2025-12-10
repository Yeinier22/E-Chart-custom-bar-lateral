import powerbi from "powerbi-visuals-api";

export function ensureSelectionPropagation(visual: any) {
  setTimeout(() => {
    try { visual.logCurrentSelectionState && visual.logCurrentSelectionState(); } catch {}
  }, 50);
}

export function logCurrentSelectionState(visual: any) {
  try {
    const currentSelections = visual.selectionManager.getSelectionIds();
  } catch {
    // Could not retrieve current selection state
  }
}

export function buildSelectionIds(visual: any) {
  visual.selectionIds = [];
  visual.categorySelectionIds = {};
  const dataView = visual.dataView as powerbi.DataView | undefined;
  if (!dataView || !dataView.categorical) return;
  const categorical = dataView.categorical;
  const categoryCols = categorical.categories || [];
  if (!categoryCols[0] || !categoryCols[0].identity) return;
  const cat1All = categoryCols[0].values || [];

  const categoryToIndices = new Map<any, number[]>();
  for (let i = 0; i < cat1All.length; i++) {
    const categoryValue = cat1All[i];
    if (!categoryToIndices.has(categoryValue)) categoryToIndices.set(categoryValue, []);
    categoryToIndices.get(categoryValue)!.push(i);
  }
  const groups = (categorical.values as any)?.grouped?.() as any[] | undefined;
  const hasSecondCategory = !!categoryCols[1] && !!categoryCols[1].identity;
  for (const [categoryValue, indices] of categoryToIndices) {
    const idsForCategory: powerbi.visuals.ISelectionId[] = [];
    try {
      for (const rowIndex of indices) {
        if (Array.isArray(groups) && groups.length > 0) {
          for (const g of groups) {
            const builder = visual.host.createSelectionIdBuilder();
            builder.withCategory(categoryCols[0], rowIndex);
            if (hasSecondCategory) builder.withCategory(categoryCols[1], rowIndex);
            const id = builder.withSeries(categorical.values, g).createSelectionId();
            idsForCategory.push(id);
          }
        } else {
          const builder = visual.host.createSelectionIdBuilder();
          builder.withCategory(categoryCols[0], rowIndex);
          if (hasSecondCategory) builder.withCategory(categoryCols[1], rowIndex);
          const id = builder.createSelectionId();
          idsForCategory.push(id);
        }
      }
      visual.categorySelectionIds[String(categoryValue)] = idsForCategory;
      visual.selectionIds.push(...idsForCategory);
    } catch (error) {
      console.warn("Failed to create selection IDs for category:", categoryValue, error);
    }
  }
}

export function buildDrillSelectionIds(visual: any, clickedCategoryLabel: any, categoryKey?: any) {
  visual.drillSelectionIds = {};
  const dataView = visual.dataView as powerbi.DataView | undefined;
  if (!dataView || !dataView.categorical) return;
  const categorical = dataView.categorical;
  const categoryCols = categorical.categories || [];
  const cat1 = categoryCols[0]?.values || [];
  const cat2 = categoryCols[1]?.values || [];
  if (!categoryCols[0] || !categoryCols[1] || !categoryCols[0].identity || !categoryCols[1].identity) return;

  const matchesCategory = (value: any) => {
    if (categoryKey !== undefined && categoryKey !== null) {
      if (value === categoryKey) return true;
      const valuePrimitive = (value !== null && value !== undefined && typeof value.valueOf === "function")
        ? value.valueOf() : value;
      const keyPrimitive = (categoryKey !== null && categoryKey !== undefined && typeof categoryKey.valueOf === "function")
        ? categoryKey.valueOf() : categoryKey;
      if (valuePrimitive === keyPrimitive) return true;
      if (String(valuePrimitive) === String(keyPrimitive)) return true;
    }
    if (value === clickedCategoryLabel) return true;
    if (value !== null && value !== undefined && clickedCategoryLabel !== null && clickedCategoryLabel !== undefined) {
      return String(value) === String(clickedCategoryLabel);
    }
    return false;
  };

  const subcategoryToIndices = new Map<any, number[]>();
  for (let i = 0; i < cat1.length; i++) {
    if (matchesCategory(cat1[i])) {
      const subcategoryValue = cat2[i];
      if (!subcategoryToIndices.has(subcategoryValue)) subcategoryToIndices.set(subcategoryValue, []);
      subcategoryToIndices.get(subcategoryValue)!.push(i);
    }
  }
  const groups = (categorical.values as any)?.grouped?.() as any[] | undefined;
  for (const [subcategoryValue, indices] of subcategoryToIndices) {
    const idsForSubcategory: powerbi.visuals.ISelectionId[] = [];
    try {
      for (const rowIndex of indices) {
        if (Array.isArray(groups) && groups.length > 0) {
          for (const g of groups) {
            const builder = visual.host.createSelectionIdBuilder();
            const id = builder
              .withCategory(categoryCols[0], rowIndex)
              .withCategory(categoryCols[1], rowIndex)
              .withSeries(categorical.values, g)
              .createSelectionId();
            idsForSubcategory.push(id);
          }
        } else {
          const builder = visual.host.createSelectionIdBuilder();
          const id = builder
            .withCategory(categoryCols[0], rowIndex)
            .withCategory(categoryCols[1], rowIndex)
            .createSelectionId();
          idsForSubcategory.push(id);
        }
      }
      visual.drillSelectionIds[String(subcategoryValue)] = idsForSubcategory;
    } catch (error) {
      console.warn("Failed to create drill selection IDs for subcategory:", subcategoryValue, error);
    }
  }
}
