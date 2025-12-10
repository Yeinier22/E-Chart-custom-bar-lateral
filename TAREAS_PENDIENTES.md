# Tareas Pendientes

## 🔴 Problema: gridRightPadding no se actualiza en modo drill

### Descripción
Cuando el usuario está en modo drill y cambia el control `gridRightPadding` en el panel de formato, el valor no se actualiza visualmente. El gráfico se re-renderiza pero siempre usa el valor por defecto (10%).

### Diagnóstico realizado
- ✅ El caché de drill funciona correctamente
- ✅ El estado de drill se mantiene al cambiar controles
- ✅ `formattingSettings` existe y tiene la estructura correcta
- ❌ `formattingSettings.dataOptionsCard.gridRightPadding.value` siempre es 10

### Logs de diagnóstico
```
🔍 Verificando formattingSettings:
  {
    "hasFormattingSettings": true,
    "hasDataOptionsCard": true,
    "hasGridRightPadding": true,
    "gridRightPaddingValue": 10,  // ❌ Siempre 10, incluso después de cambiar a 66
    "finalValue": 10
  }
```

### Línea de código afectada
- **Archivo**: `src/drill/drillHandler.ts`
- **Línea**: ~793
- **Código**: `gridRightPadding: visual.formattingSettings?.dataOptionsCard?.gridRightPadding?.value ?? 10`

### Hipótesis
1. El parser (`dataViewParser.ts`) no está actualizando `formattingSettings` cuando solo cambian los controles de formato
2. `visual.formattingSettings` se actualiza en `update()` (línea 242 de visual.ts) pero el valor parseado no refleja el cambio
3. Posiblemente se necesita leer directamente desde `dataView.metadata.objects.dataOptions.gridRightPadding`

### Próximos pasos sugeridos
1. Verificar si el valor está presente en `dataView.metadata.objects.dataOptions` (log `rawFromDataView` agregado pero no revisado)
2. Si está en dataView, leer directamente desde allí en lugar de usar `formattingSettings`
3. Si no está en dataView, investigar por qué Power BI no envía el cambio

### Workaround temporal
El control `gridRightPadding` funciona correctamente en la vista base, solo falla en modo drill.

---

## ✅ Problemas resueltos recientemente

### 1. Drill se perdía al cambiar controles
- **Solución**: Implementado sistema de caché de datos de drill
- **Archivos modificados**: 
  - `src/visual.ts`: Variables `cachedDrillCategories` y `cachedDrillSeries`
  - `src/drill/drillHandler.ts`: Lógica de caché en `renderDrillView()`

### 2. Ordenamiento TOP N incorrecto
- **Solución**: Reordenado lógica para ordenar ANTES de limitar
- **Archivo modificado**: `src/data/dataViewParser.ts`

### 3. Distancia de labels inconsistente entre base y drill
- **Solución**: Agregado control `gridRightPadding`
- **Archivos modificados**: 
  - `src/formatting/formatSettings.ts`
  - `src/rendering/chartBuilder.ts`
