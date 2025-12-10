# Feature: Margin Controls with Dynamic Resize

## Issue: Grid Lines Not Showing on First Load

**Problem**: Grid lines (splitLine) were not appearing on the initial visual load, but would appear after drill-down/back navigation or control changes. This was caused by confusion in the axis naming between Power BI and ECharts in horizontal bar charts.

**Root Cause**:
In horizontal bar charts, Power BI and ECharts use inverted axis terminology:
- **Power BI X Axis** (categories) → **ECharts yAxis** (vertical) → splitLine draws **horizontal** lines
- **Power BI Y Axis** (values) → **ECharts xAxis** (horizontal) → splitLine draws **vertical** lines

The code was incorrectly mapping `showXGridLines` and `showYGridLines` to the wrong axes.

**Solution**:
1. **Corrected variable mapping** in `visual.ts`:
   - `showXGridLines` (from X Axis PBI settings) → controls `yAxis.splitLine` in ECharts → **horizontal** grid lines
   - `showYGridLines` (from Y Axis PBI settings) → controls `xAxis.splitLine` in ECharts → **vertical** grid lines

2. **Updated defaults**:
   - `showXGridLines` = `false` (horizontal lines OFF by default)
   - `showYGridLines` = `true` (vertical lines ON by default)

3. **Fixed `baseOptionWithAxes`** (line ~1396):
   - Changed `yAxis.splitLine.show` from `showXGridLines` to `showYGridLines` (incorrect) back to `showXGridLines` (correct)

4. **Fixed `primaryAxisConfig`** (line ~1150):
   - Changed `showGridLines` from `showYGridLines` to `showXGridLines` (incorrect) back to `showYGridLines` (correct)
   - This config becomes `xAxis` in ECharts (values), so it controls vertical lines

5. **Fixed `baseParams.xAxis`** (line ~1557):
   - Changed `showGridLines` from `showYGridLines` to `showXGridLines` (correct)
   - This becomes `yAxis` in ECharts (categories), so it controls horizontal lines

6. **Added `showGridLines` field to axis objects** in `dualAxisManager.ts`:
   - `primaryAxis` and `secondaryAxis` now include `showGridLines` field
   - This ensures `renderBase()` can access the value to configure `splitLine`

**Key Files Modified**:
- `visual.ts`: Lines 1058-1087 (defaults and comments), Line 1150 (primaryAxisConfig), Line 1396 (baseOptionWithAxes.yAxis), Line 1557 (baseParams.xAxis)
- `axes/dualAxisManager.ts`: Lines 43, 72 (added showGridLines field to axis objects)
- `rendering/chartBuilder.ts`: Lines 49-65 (added debug logs for yAxis.showGridLines)

**Testing**:
- Grid lines now appear correctly on first load
- X Axis "Show Grid Lines" setting controls horizontal lines ✓
- Y Axis "Show Grid Lines" setting controls vertical lines ✓
- Grid lines persist after drill-down/back navigation ✓
- Grid lines persist after control changes ✓

## Issue: Labels at Inconsistent Distances from Bars

**Problem**: Labels appeared at different distances from their respective bars, even with the same `dlDistance` setting. This happened because ECharts calculates label `distance` from each bar's individual endpoint, not from a fixed position. Bars of different lengths resulted in labels at different absolute positions.

**Solution**: 
1. Implemented **stacked bars** with `stack: 'labelAlignment'` on all series
2. Added invisible **extension series** (`__extension__`) that extends each bar to `maxBarValue`
3. All bars now end at the same visual point, making labels with the same `distance` align perfectly
4. Extension series properties: `color: 'transparent'`, `opacity: 0`, `borderWidth: 0`, `z: -10`, `zlevel: -1`, `animation: false`, `silent: true`
5. Fixed `renderBase()` to use `containLabel: false` and respect `gridRight` parameter
6. Added `renderBase()` call after cascade animations to ensure ECharts series (with stack) are rendered, not just SVG graphics

**Key Files Modified**:
- `visual.ts`: Lines 962-1044 (stack + extension in base), Lines 1506-1545 (renderBase after animation)
- `drill/drillHandler.ts`: Lines 448-509 (stack + extension in drill), Line 1220 (renderBase after restore)
- `rendering/chartBuilder.ts`: Line 72 (`containLabel: false`, use `input.gridRight`)

## Overview
This feature adds Layout controls (marginLeft, marginRight) that adjust the chart container padding and trigger automatic resize/recalculation of bars and scale, similar to window resize behavior.

## Changes Required

### 1. Add properties to track margin state (visual.ts, ~line 105)
```typescript
// Store current bars data for resize recalculation (without animation)
private currentBars: any[] = [];
private currentMaxValue: number = 0;
private currentBarHeight: number = 0;
private previousMarginLeft: number = 10;
private previousMarginRight: number = 10;
```

### 2. Detect and apply margin changes in update() method (visual.ts, ~line 375-400)
```typescript
// Apply layout margins (always, even on resize)
const layoutSettings: any = (dataView?.metadata?.objects as any)?.layout || {};
const marginLeft = typeof layoutSettings.marginLeft === 'number' ? layoutSettings.marginLeft : 10;
const marginRight = typeof layoutSettings.marginRight === 'number' ? layoutSettings.marginRight : 10;
this.debugLogger?.log(`[LAYOUT] Applying margins: left=${marginLeft}px, right=${marginRight}px, layoutSettings=`, layoutSettings);
this.chartContainer.style.paddingLeft = `${marginLeft}px`;
this.chartContainer.style.paddingRight = `${marginRight}px`;
this.debugLogger?.log(`[LAYOUT] Container padding set: left=${this.chartContainer.style.paddingLeft}, right=${this.chartContainer.style.paddingRight}`);

// Detect margin changes
const marginsChanged = (marginLeft !== this.previousMarginLeft || marginRight !== this.previousMarginRight);
if (marginsChanged) {
  this.debugLogger?.log(`[LAYOUT] Margins changed from (${this.previousMarginLeft}, ${this.previousMarginRight}) to (${marginLeft}, ${marginRight})`);
  this.previousMarginLeft = marginLeft;
  this.previousMarginRight = marginRight;
}

// Detect if this is a pure resize (no data or formatting changes) or a formatting change
const isDataUpdate = options.type === 2 && dataView && dataView.metadata;
const isPureResize = (options.type === 4 || options.type === 36) || (options.type === 2 && !isDataUpdate);
```

### 3. Trigger resize logic when margins change (visual.ts, ~line 397-450)
```typescript
// Handle pure resize or margin changes: resize without re-animation
// Only apply this if we have existing bars (skip on first load)
if ((isPureResize || (marginsChanged && this.currentBars.length > 0)) && this.chartInstance && this.parsed?.hasData && this.currentBars.length > 0) {
  this.debugLogger?.log(`[RESIZE] ${marginsChanged ? 'Margin change' : 'Pure resize'} event, type=${options.type}`);
  this.chartInstance.resize();
  
  // Wait for ECharts to update coordinate system
  setTimeout(() => {
    // Recalculate bar positions and widths without animation
    const coordSys = (this.chartInstance as any).getModel().getComponent('grid').coordinateSystem;
    const rect = coordSys ? coordSys.getRect() : null;
    const chartWidth = this.chartContainer.clientWidth;
    const marginLeft = rect ? rect.x : 60;
    const marginRight = 30;
    const availableWidth = rect ? rect.width : (chartWidth - marginLeft - marginRight);
    
    // Use stored barHeight (don't recalculate)
    const barHeight = this.currentBarHeight;
    
    // Build category center Y map using new coordinate system
    const categoryCenterY: { [cat: string]: number } = {};
    if (typeof (this.chartInstance as any).convertToPixel === 'function') {
      this.currentBars.forEach((bar: any) => {
        const label = bar.categoryLabel;
        if (!(label in categoryCenterY)) {
          try {
            const yPx = (this.chartInstance as any).convertToPixel({ yAxisIndex: 0 }, label);
            if (typeof yPx === 'number' && isFinite(yPx)) {
              categoryCenterY[label] = yPx;
            }
          } catch {}
        }
      });
    }
    
    // Recalculate widths and positions, keep height unchanged
    const updatedGraphics = this.currentBars.map((bar: any) => {
      const width = (bar.value / this.currentMaxValue) * availableWidth;
      const centerY = categoryCenterY[bar.categoryLabel];
      const finalY = typeof centerY === 'number' ? (centerY - barHeight / 2) : undefined;
      
      const update: any = {
        id: bar.id,
        shape: {
          x: marginLeft,
          width: width
        },
        $action: 'merge'
      };
      
      if (finalY !== undefined) {
        update.shape.y = finalY;
      }
      
      return update;
    });
    
    this.chartInstance.setOption({ graphic: updatedGraphics }, false);
    this.debugLogger?.log(`[RESIZE] Updated ${updatedGraphics.length} bars to new dimensions`);
  }, 50);
  
  return;
}
```

### 4. Add Layout object definition in capabilities.json
```json
"layout": {
  "displayName": "Layout",
  "properties": {
    "marginLeft": {
      "displayName": "Left Margin",
      "description": "Horizontal margin on the left side (px)",
      "type": { "numeric": true }
    },
    "marginRight": {
      "displayName": "Right Margin",
      "description": "Horizontal margin on the right side (px)",
      "type": { "numeric": true }
    }
  }
}
```

### 5. Add Layout card settings in formatSettings.ts
```typescript
class LayoutCardSettings extends Card {
  marginLeft = new formattingSettings.NumUpDown({
    name: "marginLeft",
    displayName: "Left Margin",
    value: 10,
    options: {
      minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
      maxValue: { value: 500, type: powerbi.visuals.ValidatorType.Max }
    }
  });

  marginRight = new formattingSettings.NumUpDown({
    name: "marginRight",
    displayName: "Right Margin",
    value: 10,
    options: {
      minValue: { value: 0, type: powerbi.visuals.ValidatorType.Min },
      maxValue: { value: 500, type: powerbi.visuals.ValidatorType.Max }
    }
  });

  name: string = "layout";
  displayName: string = "Layout";
  slices = [this.marginLeft, this.marginRight];
}

// Add to VisualFormattingSettingsModel.cards array
layoutCard = new LayoutCardSettings();
```

## How It Works

1. **Margin Detection**: Compares current margin values with previous values to detect changes
2. **CSS Padding**: Applies padding to chartContainer, reducing visible space
3. **ECharts Resize**: Calls `chartInstance.resize()` to recalculate coordinate system
4. **Bar Recalculation**: 
   - Gets new `rect.width` from ECharts grid
   - Recalculates bar widths proportionally: `(value / maxValue) * availableWidth`
   - Maintains constant bar height (no recalculation)
   - Repositions bars using `convertToPixel` for accurate Y coordinates
5. **No Animation**: Updates happen instantly without triggering animation

## Benefits

- Margins work like window resize: bars scale proportionally
- X-axis scale adjusts automatically
- Bar height stays constant (only width changes)
- No animation on margin changes (instant adjustment)
- Works for multiple subsequent changes (not just first change)

## Testing

1. Change Left Margin → bars should scale proportionally, moving X-axis left
2. Change Right Margin → bars should scale proportionally, X-axis adjusts
3. Change both margins → combined effect, bars scale to new available width
4. Multiple changes → each change should work correctly (not just first)
5. Resize window → should still work as before (independent of margin changes)
