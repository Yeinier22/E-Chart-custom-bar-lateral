# Selection feature – código completo extraído

Este documento contiene **TODO el código relacionado con la selección** extraído del código actual de `visual.ts` y `capabilities.json` para análisis externo.

---

## 1. capabilities.json – objeto selectionStyle

**Ubicación:** `capabilities.json` > `objects` > `selectionStyle`

```json
"selectionStyle": {
  "displayName": "Selection Style",
  "properties": {
    "color": {
      "displayName": "Fill color",
      "type": { "fill": { "solid": { "color": true } } }
    },
    "borderColor": {
      "displayName": "Border color",
      "type": { "fill": { "solid": { "color": true } } }
    },
    "borderWidth": {
      "displayName": "Border width",
      "type": { "numeric": true }
    },
    "opacity": {
      "displayName": "Opacity (%)",
      "type": { "numeric": true }
    }
  }
}
```

---

## 2. visual.ts – Estados privados relacionados con selección

**Ubicación:** Dentro de la clase `Visual`

```typescript
private selectionGraphic: any[] = [];
private selectedIndex: number | null = null;
private currentCategories: any[] = [];
```

---

## 3. visual.ts – Lectura de configuración selectionStyle en update()

**Ubicación:** Dentro del método `update()`, después de leer hoverStyle

```typescript
// Selection Style settings (for clicks in drill level)
const selObj: any = (dataView.metadata?.objects as any)?.selectionStyle || {};
const selColor: string = getSolidColor(selObj?.color?.solid?.color || "#0096FF");
const selBorderColor: string = getSolidColor(selObj?.borderColor?.solid?.color || "#0078D4");
const selBorderWidth: number = typeof selObj?.borderWidth === "number" ? selObj.borderWidth : 1.5;
const selOpacityPct: number = typeof selObj?.opacity === "number" ? selObj.opacity : 40;
const selOpacity: number = Math.max(0, Math.min(1, selOpacityPct / 100));
```

---

## 4. visual.ts – Limpieza de selección en restoreBaseView()

**Ubicación:** Dentro del método `restoreBaseView()`

```typescript
// Clear any selection when returning to base level
this.selectedIndex = null;
this.selectionGraphic = [];
this.currentCategories = Array.isArray(this.baseCategories) ? [...this.baseCategories] : [];
(this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
this.updateDrillGraphics();
```

---

## 5. visual.ts – Limpieza de selección en resetFullView()

**Ubicación:** Dentro del método `resetFullView()`

```typescript
// In drill level: reset only clears selection band; Back button restores
if (this.isDrilled) {
  this.selectedIndex = null;
  this.selectionGraphic = [];
  this.updateDrillGraphics();
  return;
}
```

---

## 6. visual.ts – Merge de capas gráficas en updateDrillGraphics()

**Ubicación:** Dentro del método `updateDrillGraphics()`

```typescript
const combined = [
  ...(this.isDrilled ? (this.selectionGraphic || []) : []),
  ...(this.hoverGraphic || []),
  ...buttons,
];
(this.chartInstance as any).setOption(
  { graphic: combined } as any,
  { replaceMerge: ["graphic"] }
);
```

---

## 7. visual.ts – Helper `drawSelectionBand(...)`

**Ubicación:** Método privado dentro de la clase `Visual`

```typescript
private drawSelectionBand(
  idx: number,
  expandX: number,
  expandY: number,
  selColor: string,
  selBorderColor: string,
  selBorderWidth: number,
  selOpacity: number
): void {
  if (!this.isDrilled) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
    (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    this.updateDrillGraphics();
    return;
  }

  const cats = this.currentCategories || [];
  if (!Array.isArray(cats) || idx < 0 || idx >= cats.length) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
    (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    this.updateDrillGraphics();
    return;
  }

  const ec: any = this.chartInstance as any;
  const centerPx = ec.convertToPixel({ xAxisIndex: 0 }, cats[idx]);
  const leftCenter = idx > 0 ? ec.convertToPixel({ xAxisIndex: 0 }, cats[idx - 1]) : undefined;
  const rightCenter = idx < cats.length - 1 ? ec.convertToPixel({ xAxisIndex: 0 }, cats[idx + 1]) : undefined;
  let halfStep = 20;
  if (leftCenter !== undefined && rightCenter !== undefined) {
    halfStep = Math.min(Math.abs(centerPx - leftCenter), Math.abs(rightCenter - centerPx)) / 2;
  } else if (rightCenter !== undefined) {
    halfStep = Math.abs(rightCenter - centerPx) / 2;
  } else if (leftCenter !== undefined) {
    halfStep = Math.abs(centerPx - leftCenter) / 2;
  }
  const coord0 = centerPx - halfStep;
  const coord1 = centerPx + halfStep;
  const grid = ec.getModel().getComponent("grid", 0);
  let topPx = 0;
  let bottomPx = 0;
  try {
    const rect = grid?.coordinateSystem?.getRect();
    topPx = rect?.y ?? 0;
    bottomPx = (rect?.y ?? 0) + (rect?.height ?? 0);
  } catch {}
  const leftPx = Math.min(coord0, coord1) - expandX;
  const rightPx = Math.max(coord0, coord1) + expandX;
  const width = Math.max(0, rightPx - leftPx);
  const height = Math.max(0, bottomPx - topPx + expandY);
  const rectX = leftPx;
  const rectY = topPx - expandY;

  this.selectionGraphic = [
    {
      type: "rect",
      id: "selectionBand",
      z: 6,
      shape: { x: rectX, y: rectY, width, height, r: 6 },
      style: {
        fill: selColor,
        stroke: selBorderColor,
        lineWidth: selBorderWidth,
        fillOpacity: selOpacity,
        strokeOpacity: selOpacity,
      },
      silent: false,
      cursor: "pointer",
      onclick: () => {
        this.selectedIndex = null;
        this.selectionGraphic = [];
        this.updateDrillGraphics();
      },
    },
  ];
  this.updateDrillGraphics();
}
```

---

## 8. visual.ts – Asignación de `currentCategories` en update()

**Ubicación:** En `update()`, después de `this.chartInstance.resize()`

```typescript
this.currentCategories = Array.isArray(categories) ? [...categories] : [];
```

---

## 9. visual.ts – Helper `renderDrillView(...)` (persistencia en drill)

**Ubicación:** Función local dentro de `update()`

```typescript
const renderDrillView = (categoryLabel: string, resetSelection: boolean, categoryKey?: any): boolean => {
  const built = this.buildDrillForCategory(categoryLabel, categoryKey);
  if (!built.categories || built.categories.length === 0) {
    return false;
  }

  const displayLabel =
    categoryLabel ??
    (categoryKey !== undefined && categoryKey !== null ? String(categoryKey) : "");

  const objects: any = this.dataView?.metadata?.objects || {};
  const legendSettings: any = objects?.legend || {};
  const pos: string = legendSettings["position"] || "top";
  const align: string = legendSettings["alignment"] || "center";
  const extra: number = typeof legendSettings["extraMargin"] === "number" ? legendSettings["extraMargin"] : 0;
  const padding: number = typeof legendSettings["padding"] === "number" ? legendSettings["padding"] : 0;
  const isVerticalDetail = pos === "left" || pos === "right";
  let dTop: any = undefined;
  let dBottom: any = undefined;
  let dLeft: any = undefined;
  let dRight: any = undefined;
  if (pos === "top") dTop = `${8 + extra}%`;
  if (pos === "bottom") dBottom = `${10 + extra}%`;
  if (pos === "left") { dLeft = "2%"; dTop = "5%"; }
  if (pos === "right") { dRight = "2%"; dTop = "5%"; }
  if (pos === "top" || pos === "bottom") {
    if (align === "left") dLeft = "2%";
    else if (align === "right") dRight = "2%";
    else dLeft = "center";
  }
  const dGridBottom = pos === "bottom" ? `${15 + extra}%` : "3%";

  const drillSeriesWithHover = (built.series || []).map((s: any) => ({
    ...s,
    emphasis: { focus: undefined, scale: false },
    stateAnimation: { duration: hoverDuration, easing: hoverEasing },
  }));
  const drillLegendNames = (built.series || []).map((s: any) => s.name);

  this.chartInstance.setOption(
    {
      title: {
        text: `Details for ${displayLabel}`,
        left: "center",
        top: "2%",
        textStyle: { fontSize: 16 as any, fontWeight: "bold", color: "#333" },
      },
      legend: {
        data: drillLegendNames,
        top: dTop,
        bottom: dBottom,
        left: dLeft,
        right: dRight,
        orient: isVerticalDetail ? "vertical" : "horizontal",
        padding,
      },
      xAxis: { data: built.categories },
      series: drillSeriesWithHover as any,
      grid: { left: "3%", right: "4%", bottom: dGridBottom, containLabel: true },
      animationDurationUpdate: 800,
      animationEasingUpdate: "cubicInOut",
    } as any,
    false
  );

  this.isDrilled = true;
  this.drillCategory = displayLabel;
  this.drillCategoryKey = categoryKey ?? categoryLabel ?? displayLabel;
  this.currentCategories = Array.isArray(built.categories) ? [...built.categories] : [];
  currentHoverIndex = null;
  this.hoverGraphic = [];

  if (resetSelection) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
  } else if (
    this.selectedIndex === null ||
    this.selectedIndex < 0 ||
    this.selectedIndex >= this.currentCategories.length
  ) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
  }

  (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
  if (this.selectedIndex !== null) {
    this.drawSelectionBand(
      this.selectedIndex,
      expandX,
      expandY,
      selColor,
      selBorderColor,
      selBorderWidth,
      selOpacity
    );
  } else {
    this.updateDrillGraphics();
  }

  updateHoverBand(null);
  bindHoverHandlers();
  return true;
};
```

---

## 10. visual.ts – Click handler (drill-in + selección persistente)

**Ubicación:** Dentro de `update()`

```typescript
this.chartInstance.on("click", (params: any) => {
  if (params && params.componentType === "series" && !this.isDrilled) {
    const clickedCategoryLabel: string = params.name;
    const clickedIndex: number =
      typeof params.dataIndex === "number"
        ? params.dataIndex
        : (this.currentCategories || []).indexOf(clickedCategoryLabel);
    const baseCats =
      (Array.isArray(this.baseCategories) && this.baseCategories.length > 0)
        ? this.baseCategories
        : this.currentCategories;
    const clickedKey =
      clickedIndex >= 0 && baseCats && clickedIndex < baseCats.length
        ? baseCats[clickedIndex]
        : clickedCategoryLabel;
    renderDrillView(clickedCategoryLabel, true, clickedKey);
    return;
  } else if (this.isDrilled && params && params.componentType === "series") {
    const name = params.name;
    const cats = this.currentCategories || [];
    const idx = cats.indexOf(name);
    if (idx >= 0) {
      if (this.selectedIndex === idx) {
        this.selectedIndex = null;
        this.selectionGraphic = [];
        this.updateDrillGraphics();
        return;
      }
      if (!this.isDrilled) {
        this.selectedIndex = null;
        this.selectionGraphic = [];
        (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
        this.updateDrillGraphics();
        return;
      }
      this.selectedIndex = idx;
      this.drawSelectionBand(idx, expandX, expandY, selColor, selBorderColor, selBorderWidth, selOpacity);
    }
  }
});
```

---

## 11. visual.ts – Persistencia de drill tras `update()`

**Ubicación:** Bloque al final de `update()` (antes del `dblclick` handler)

```typescript
if (this.isDrilled && this.drillCategory) {
  if (!renderDrillView(this.drillCategory, false, this.drillCategoryKey)) {
    this.restoreBaseView();
  }
} else {
  this.hoverGraphic = [];
  if (this.selectedIndex !== null) {
    this.selectedIndex = null;
  }
  this.selectionGraphic = [];
  (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
  this.updateDrillGraphics();
}
```

---

## 12. visual.ts – `enumerateObjectInstances` para selectionStyle

**Ubicación:** Dentro del método `enumerateObjectInstances()`

```typescript
if (options.objectName === "selectionStyle") {
  const sel: any = (this.dataView?.metadata?.objects as any)?.selectionStyle || {};
  enumeration.push({
    objectName: "selectionStyle",
    displayName: "Selection Style",
    properties: {
      color: { solid: { color: sel?.color?.solid?.color || "#0096FF" } },
      borderColor: { solid: { color: sel?.borderColor?.solid?.color || "#0078D4" } },
      borderWidth: typeof sel?.borderWidth === "number" ? sel.borderWidth : 1.5,
      opacity: typeof sel?.opacity === "number" ? sel.opacity : 40
    },
    selector: undefined as any
  });
}
```

---

## RESUMEN DE FLUJO COMPLETO

### Estados involucrados
- `selectionGraphic: any[]` - Array con el rectángulo de selección
- `selectedIndex: number | null` - Índice de la categoría seleccionada
- `currentCategories: any[]` - Categorías del nivel actual (base o drill)
- `drillCategoryKey: any` - Valor bruto de la categoría en drill para reconstruir índices
- `isDrilled: boolean` - Flag de nivel (base=false, drill=true)

### Flujo de selección

1. **Nivel base (isDrilled = false)**
   - Click → drill-in
   - No se dibuja selección
   - `updateDrillGraphics()` excluye `selectionGraphic` del merge

2. **Entrada a drill**
  - `renderDrillView(clickedCategory, true)` reconstruye la vista detalle.
    - `renderDrillView(clickedCategory, true, clickedKey)` reconstruye la vista detalle usando también el valor bruto.
  - Limpia selección y overlays con `setOption({ graphic: [] }, { replaceMerge: ['graphic'] })` antes de volver a dibujar.
  - Actualiza `currentCategories` con las categorías hijas.

3. **Nivel drill (isDrilled = true)**
  - Click sobre categoría:
    - Si `selectedIndex === idx` → toggle off (limpia y return)
    - Si no → `drawSelectionBand(idx, expandX, expandY, ...)` pinta la banda persistente.
  - `updateDrillGraphics()` incluye `selectionGraphic` en el merge (z:6).

4. **Salir de drill (Back/Restore)**
  - Limpia: `selectedIndex = null`, `selectionGraphic = []` y hover.
  - Ejecuta: `setOption({ graphic: [] }, { replaceMerge: ['graphic'] })` + `updateDrillGraphics()`.
  - Restaura `currentCategories = baseCategories`.

5. **Reset en drill**
  - Solo limpia selección (no sale del drill).
  - Ejecuta: `updateDrillGraphics()` (que a su vez hace `replaceMerge`).

6. **Actualizaciones de formato/datos**
  - Al final de `update()`, `renderDrillView(this.drillCategory, false, this.drillCategoryKey)` mantiene el nivel detalle y re-aplica selección con los nuevos estilos.

### Merge de capas gráficas
```typescript
const combined = [
  ...(this.isDrilled ? (this.selectionGraphic || []) : []),  // z:6 solo en drill
  ...(this.hoverGraphic || []),                               // z:5 siempre
  ...buttons                                                  // z:1000 siempre
];
(this.chartInstance as any).setOption(
  { graphic: combined } as any,
  { replaceMerge: ['graphic'] }
);
```

### Variables de estilo usadas
- `selColor` - Color de relleno (sólido, sin alfa)
- `selBorderColor` - Color de borde (sólido, sin alfa)
- `selBorderWidth` - Ancho del borde en px
- `selOpacity` - Opacidad 0-1 (aplicada como fillOpacity y strokeOpacity)
- `expandX`, `expandY` - Reutilizados de hoverStyle para overshoot

### Guard crítico
```typescript
if (!this.isDrilled) {
  this.selectedIndex = null;
  this.selectionGraphic = [];
  return;
}
```

Este guard aparece en:
- Click handler de drill level (antes de dibujar banda)
- Implícitamente en `updateDrillGraphics()` vía spread condicional

### Sincronización con ECharts
Se limpia usando `setOption({ graphic: [] }, { replaceMerge: ['graphic'] })` y enseguida `updateDrillGraphics()` para que ECharts olvide por completo la capa previa antes de volver a dibujar.

---

## ANÁLISIS DE PROBLEMAS POTENCIALES

### ✅ Problema: La selección aparece en nivel base
**Causa:** `updateDrillGraphics()` incluye `selectionGraphic` sin condición `isDrilled`  
**Status actual:** ✅ RESUELTO - merge usa `...(this.isDrilled ? selectionGraphic : [])`

### ✅ Problema: Selección persiste al volver a base
**Causa:** `restoreBaseView()` no limpia selección o no llama `updateDrillGraphics()`  
**Status actual:** ✅ RESUELTO - limpia y llama `updateDrillGraphics()`

### ✅ Problema: No se puede deseleccionar
**Causa:** Falta toggle con `return` o banda no es clickable  
**Status actual:** ✅ RESUELTO - toggle con return + banda con onclick

### ✅ Problema potencial: strokeOpacity calculada
**Observación:** Antes se elevaba `strokeOpacity` con `+0.2`  
**Status actual:** ✅ RESUELTO - ahora `strokeOpacity` = `selOpacity`

### ⚠️ Problema potencial: currentCategories no actualizado en resize
**Observación:** `currentCategories` se actualiza en update() y drill-in  
**Riesgo:** Si el usuario hace resize sin update, las coordenadas pueden desalinearse  
**Status:** Bajo riesgo (Power BI llama update() en resize normalmente)

---

## 10. visual.ts – Helper `drawSelectionBand(...)` (banda persistente)

El helper ya está implementado y centraliza toda la lógica de la banda de selección. Controla los guardas de `isDrilled`, valida el índice dentro de `currentCategories` y recalcula el rectángulo en coordenadas de píxel antes de actualizar `selectionGraphic`.

```typescript
private drawSelectionBand(
  idx: number,
  expandX: number,
  expandY: number,
  selColor: string,
  selBorderColor: string,
  selBorderWidth: number,
  selOpacity: number
): void {
  if (!this.isDrilled) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
    (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    this.updateDrillGraphics();
    return;
  }

  const cats = this.currentCategories || [];
  if (!Array.isArray(cats) || idx < 0 || idx >= cats.length) {
    this.selectedIndex = null;
    this.selectionGraphic = [];
    (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    this.updateDrillGraphics();
    return;
  }

  const ec: any = this.chartInstance as any;
  const centerPx = ec.convertToPixel({ xAxisIndex: 0 }, cats[idx]);
  const leftCenter = idx > 0 ? ec.convertToPixel({ xAxisIndex: 0 }, cats[idx - 1]) : undefined;
  const rightCenter = idx < cats.length - 1 ? ec.convertToPixel({ xAxisIndex: 0 }, cats[idx + 1]) : undefined;
  let halfStep = 20;
  if (leftCenter !== undefined && rightCenter !== undefined) {
    halfStep = Math.min(Math.abs(centerPx - leftCenter), Math.abs(rightCenter - centerPx)) / 2;
  } else if (rightCenter !== undefined) {
    halfStep = Math.abs(rightCenter - centerPx) / 2;
  } else if (leftCenter !== undefined) {
    halfStep = Math.abs(centerPx - leftCenter) / 2;
  }

  const coord0 = centerPx - halfStep;
  const coord1 = centerPx + halfStep;
  const grid = ec.getModel().getComponent("grid", 0);
  let topPx = 0;
  let bottomPx = 0;
  try {
    const rect = grid?.coordinateSystem?.getRect();
    topPx = rect?.y ?? 0;
    bottomPx = (rect?.y ?? 0) + (rect?.height ?? 0);
  } catch {}

  const leftPx = Math.min(coord0, coord1) - expandX;
  const rightPx = Math.max(coord0, coord1) + expandX;
  const width = Math.max(0, rightPx - leftPx);
  const height = Math.max(0, bottomPx - topPx + expandY);
  const rectX = leftPx;
  const rectY = topPx - expandY;

  this.selectionGraphic = [
    {
      type: "rect",
      id: "selectionBand",
      z: 6,
      shape: { x: rectX, y: rectY, width, height, r: 6 },
      style: {
        fill: selColor,
        stroke: selBorderColor,
        lineWidth: selBorderWidth,
        fillOpacity: selOpacity,
        strokeOpacity: selOpacity,
      },
      silent: false,
      cursor: "pointer",
      onclick: () => {
        this.selectedIndex = null;
        this.selectionGraphic = [];
        this.updateDrillGraphics();
      },
    },
  ];

  this.updateDrillGraphics();
}
```

**Por qué resulta clave:**
- Encapsula la limpieza cuando `idx` es inválido o el usuario regresa al nivel base.
- Reutiliza `replaceMerge` para sobrescribir la banda sin duplicar overlays previos.
- Mantiene un único lugar para ajustar cálculos de expansión o estilos.
---

## CHECKLIST DE VALIDACIÓN

- [x] **capabilities.json** tiene objeto `selectionStyle` con 4 propiedades
- [x] **capabilities.json** añade `labelVisibility` dataRole (Measure opcional con DAX expression personalizada)
- [x] **Estados privados** declarados: `selectionGraphic`, `selectedIndex`, `currentCategories`, `drillCategoryKey`
- [x] **Lectura de estilo** usa `getSolidColor()` para eliminar alfa
- [x] **Merge condicional** en `updateDrillGraphics()` con guard `isDrilled`
- [x] **Toggle** implementado con check `selectedIndex === idx` + return
- [x] **Limpieza en restore** usa `setOption({ graphic: [] }, { replaceMerge: ['graphic'] })` + `updateDrillGraphics()`
- [x] **Limpieza en drill-in** antes de construir vista de detalle con `replaceMerge`
- [x] **Reset en drill** solo limpia selección sin salir
- [x] **Banda clickable** con `silent: false` + `onclick`
- [x] **enumerateObjectInstances** expone panel de formato
- [x] **currentCategories** actualizado en base y drill

---

## DEFAULTS CONFIGURADOS

| Propiedad | Valor por defecto |
|-----------|-------------------|
| color | `#0096FF` (azul claro) |
| borderColor | `#0078D4` (azul Microsoft) |
| borderWidth | `1.5` px |
| opacity | `40` % (0.4 en fillOpacity) |
| expandX | Reutilizado de hoverStyle (8px) |
| expandY | Reutilizado de hoverStyle (8px) |

---

## NOTAS DE IMPLEMENTACIÓN

1. **Reutilización de expandX/expandY:** La selección usa los mismos valores de overshoot que el hover para mantener consistencia visual. Si se desea independencia, agregar `expandX` y `expandY` a `selectionStyle` en capabilities.json.

2. **strokeOpacity vs fillOpacity:** Se usa el mismo valor (`selOpacity`) para relleno y borde para evitar sombras inconsistentes.

3. **z-index layers:** 
   - Selection: z:6 (encima de hover)
   - Hover: z:5
   - Buttons: z:1000 (siempre visibles)

4. **Diferencia hover vs selection:**
   - Hover: transitorio, z:5, `silent:true`, se limpia en mouseleave
   - Selection: persistente, z:6, `silent:false` con onclick, se limpia en Back/Reset/toggle

5. **ECharts state management:** Usa `setOption({ graphic: [] }, { replaceMerge: ['graphic'] })` seguido de `updateDrillGraphics()` para forzar que ECharts olvide la capa previa y no deje bandas "flotando".

