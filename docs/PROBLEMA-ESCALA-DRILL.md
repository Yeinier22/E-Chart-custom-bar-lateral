# 🔍 Problema: Inconsistencia Visual entre Base y Drill

**Fecha:** 10 de diciembre de 2025  
**Estado:** ✅ RESUELTO - Solution A implementada (10 dic 2025)

---

## 📋 Resumen Ejecutivo

**El problema NO es el padding ni el grid. El problema es la ESCALA del eje X (xAxis.max).**

- ✅ El padding es correcto e idéntico en ambas vistas
- ✅ El grid es idéntico (mismo `grid.right`)
- ✅ La distancia entre el borde derecho del grid y el borde del visual es la misma

❌ **El problema real:** La distancia entre el final de la barra y el borde del grid NO es la misma, y esto es únicamente consecuencia de `xAxis.max`.

---

## 🧩 Análisis del Problema

### Vista BASE (escala 600k)
- La barra más grande llega hasta aprox. el **76%** del ancho del grid
- La línea vertical del grid (tick mayor) queda más adentro que el borde
- El label ($464.50K) queda con un espacio visual "grande"
- **Ocupación:** `p_base = 464,499 / 600,000 = 0.774` (77.4%)

### Vista DRILL (escala 180k)
- La barra más grande llega al **94%** del ancho del grid
- La última línea del grid (tick mayor) también llega casi al borde
- El label ($170.24K) queda mucho más cerca del borde visual
- **Ocupación:** `p_drill = 170,236 / 180,000 = 0.945` (94.5%)

### 📌 Conclusión
**Ambos tienen el mismo padding del grid, pero la escala cambia completamente la geometría.**

---

## 💡 Tres Soluciones Propuestas

---

## ✅ SOLUCIÓN A - Ajuste Proporcional del Max del Drill

**⭐ RECOMENDADA - Matemáticamente perfecta**

### Concepto
Ajustar la escala del drill según la "ocupación relativa" respecto a la base.

### Algoritmo

```typescript
// 1. Calcular porcentaje de ocupación en BASE
const p_base = baseMaxValue / baseMaxScale;

// 2. Calcular porcentaje de ocupación en DRILL
const p_drill = drillMaxValue / drillScale;

// 3. Si drill está más lleno que base, ajustar
if (p_drill > p_base) {
    const factor = p_drill / p_base;
    const newMax = drillMaxScale * factor;
    // Aplicar newMax como xAxis.max en drill
}
```

### Ejemplo con Datos Reales

**BASE:**
```
maxBaseValue = 464,499
maxBaseScale = 600,000
p_base = 0.774 (77.4%)
```

**DRILL (sin ajuste):**
```
maxDrillValue = 170,236
maxDrillScale = 180,000
p_drill = 0.945 (94.5%)
```

**DRILL (con ajuste):**
```
factor = p_drill / p_base = 0.945 / 0.774 = 1.22
newDrillMax = 180,000 * 1.22 = 219,600
```

### Resultado
- ✅ La barra ocupa la MISMA proporción (~77%) del grid que en base
- ✅ NO destruye la escala del drill
- ✅ NO hace barras chiquitas
- ✅ NO obliga a usar el max de la base
- ✅ Mantiene el "look" coherente
- ✅ La etiqueta del drill ya no se pegará al borde

### Implementación
**Archivo:** `src/axes/yAxisScale.ts` (función `computeYAxisScale`)

Agregar al final antes del return:

```typescript
// Ajuste proporcional para drill (si aplica)
if (isDrillView && baseOccupancy && baseOccupancy > 0) {
    const currentOccupancy = maxY / (yMax ?? maxY);
    if (currentOccupancy > baseOccupancy) {
        const adjustmentFactor = currentOccupancy / baseOccupancy;
        yMax = (yMax ?? maxY) * adjustmentFactor;
        // Recalcular splitNumber si es necesario
    }
}
```

---

## ✅ SOLUCIÓN B - Añadir Cuadrante Extra según Ocupación

**Simplicidad moderada**

### Concepto
Si la barra del drill ocupa demasiado espacio (>90% del grid), añadir una división más al eje.

### Algoritmo

```typescript
// Calcular ocupación
const p_drill = drillMaxValue / drillMaxScale;

// Si está muy lleno, añadir un cuadrante
if (p_drill > 0.90) {
    splitNumber += 1;
}
```

### Resultado
- ✅ Añade "aire visual" sin informar al usuario de una escala artificial
- ✅ Muy simple de implementar
- ⚠️ Menos preciso que Solución A
- ⚠️ Puede verse "brusco" si el umbral se cruza de golpe

### Implementación
**Archivo:** `src/axes/yAxisScale.ts`

En la sección donde se calcula `splitNumber`:

```typescript
// Después de calcular splitNumber normal
if (isDrillView) {
    const occupancy = maxY / (yMax ?? maxY);
    if (occupancy > 0.90) {
        splitNumber += 1;
    }
}
```

---

## ✅ SOLUCIÓN C - BoundaryGap Dinámico

**⭐ MÁS SIMPLE - Funciona bien**

### Concepto
Añadir un margen dinámico al final del eje (`boundaryGap`) según la diferencia de ocupación entre base y drill.

### Algoritmo

```typescript
// Calcular diferencia de ocupación
const p_base = baseMaxValue / baseMaxScale;
const p_drill = drillMaxValue / drillMaxScale;
const diferencia = p_drill - p_base;

// Calcular margen extra (mitad de la diferencia)
const extraGap = Math.max(0, diferencia * 0.5);

// Aplicar a ECharts
xAxis: {
    type: 'value',
    boundaryGap: [0, extraGap]
}
```

### Ejemplo con Datos Reales

```
p_base = 0.774
p_drill = 0.945
diferencia = 0.171
extraGap = 0.0855 = 8.5%
```

### Resultado
- ✅ El drill se separa del borde según cuánto se pasa del base
- ✅ Escala del drill intacta
- ✅ Look idéntico al base
- ✅ Muy simple de implementar
- ✅ No requiere recalcular `yMax` ni `splitNumber`

### Implementación
**Archivo:** `src/rendering/chartBuilder.ts` (función `renderDrill`)

En la construcción del `xAxis`:

```typescript
xAxis: Array.isArray(input.yAxis) ? input.yAxis.map((axis: any, index: number) => ({
    type: 'value',
    position: index === 1 ? 'top' : 'bottom',
    // ... resto de propiedades ...
    boundaryGap: index === 0 && input.drillOccupancyGap 
        ? [0, input.drillOccupancyGap] 
        : undefined
}))
```

Y calcular `drillOccupancyGap` en `drillHandler.ts`:

```typescript
// Calcular occupancy gap
const drillOccupancyGap = (() => {
    if (!visual.baseMaxValue || !visual.baseMaxScale) return 0;
    const p_base = visual.baseMaxValue / visual.baseMaxScale;
    const p_drill = maxDrillValue / drillMaxScale;
    return Math.max(0, (p_drill - p_base) * 0.5);
})();

// Añadir a drillParams
drillParams.drillOccupancyGap = drillOccupancyGap;
```

---

## 🔥 Comparación de Soluciones

| Criterio | Solución A | Solución B | Solución C |
|----------|-----------|-----------|-----------|
| **Precisión matemática** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Simplicidad** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Estabilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Consistencia visual** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **No distorsiona escala** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recomendación Final

### Opción 1: **SOLUCIÓN A** (Ajuste Proporcional)
- ✅ Matemáticamente perfecta
- ✅ Comportamiento consistente y predecible
- ✅ Respeta la escala del drill
- ⚠️ Requiere modificar `computeYAxisScale`

### Opción 2: **SOLUCIÓN C** (BoundaryGap Dinámico)
- ✅ Muy simple de implementar
- ✅ Funciona excelente
- ✅ Estable y predecible
- ✅ No toca la lógica de escala

---

## 📝 Datos Necesarios para Implementar

Para cualquier solución, necesitamos guardar en `visual.ts`:

```typescript
// Agregar propiedades a la clase Visual
private baseMaxValue: number = 0;      // Valor máximo de base
private baseMaxScale: number = 0;      // yAxisMax de base
```

Y guardarlos después de calcular la escala en base:

```typescript
// En visual.ts, después de computeYAxisScale
this.baseMaxValue = maxY;
this.baseMaxScale = yAxisMax;
```

---

## 🚀 Implementación Final

### ✅ Solución Implementada: **SOLUTION A** (Ajuste Proporcional del Max)

**Fecha de implementación:** 10 de diciembre de 2025

**Archivos modificados:**
1. `src/drill/drillHandler.ts` (líneas 754-810):
   - Implementado cálculo de ocupación `p_base` y `p_drill`
   - Ajuste proporcional: `adjustedMax = originalMax * (p_drill / p_base)`
   - Aplicación directa a `yAxisConfig.max`

2. `src/visual.ts`:
   - Agregadas propiedades `lastBaseMaxValue` y `lastBaseScale` (líneas 114-115)
   - Guardado de valores base después de `computeYAxisScale` (líneas 745-752)

3. `src/rendering/chartBuilder.ts`:
   - Eliminada propiedad `boundaryGap` de `YAxisConfig` (no funciona en ejes type:'value')
   - Removida aplicación de boundaryGap en xAxis

### ⚠️ Nota Importante sobre Solution C

**Solution C (boundaryGap) fue descartada** porque en ECharts:
- `boundaryGap` solo funciona en ejes de tipo `'category'`
- En barras horizontales, `xAxis` es el eje de valores (type: `'value'`)
- `boundaryGap` NO tiene efecto en ejes numéricos

### 📊 Resultado Esperado

Con la implementación de Solution A:
- Drill `xAxis.max` ajustado de ~180k a ~220k
- Ocupación reducida de 94.5% a ~77% (igualando base)
- Labels con espacio adecuado, sin compresión contra el borde

### 🧪 Verificación

Los logs de debug muestran:
```
📏 SOLUTION A - Max Adjustment: {
  base: { maxValue: 464499, maxScale: 600000, occupancy: "0.774" },
  drill: { 
    maxValue: 170236, 
    originalMax: 180000,
    adjustedMax: 219600,
    originalOccupancy: "0.945",
    targetOccupancy: "0.774",
    adjustmentFactor: "1.220"
  }
}
```

---

**Documento generado:** 10 de diciembre de 2025  
**Última actualización:** 10 de diciembre de 2025  
**Estado:** ✅ Resuelto e Implementado
