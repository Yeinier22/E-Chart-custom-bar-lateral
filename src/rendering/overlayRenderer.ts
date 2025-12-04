import * as echarts from 'echarts';

export interface BandRect { x: number; y: number; width: number; height: number; }

// Compute the rectangle bounds for a category band (hover/selection) in pixels
export function computeBandRect(
  ec: echarts.ECharts,
  categories: any[],
  index: number,
  expandX: number,
  expandY: number
): BandRect | null {
  if (!ec || !Array.isArray(categories) || index < 0 || index >= categories.length) return null;
  try {
    // For horizontal bar charts, categories are on Y axis
    const centerPx = (ec as any).convertToPixel({ yAxisIndex: 0 }, categories[index]);
    const topCenter = index > 0 ? (ec as any).convertToPixel({ yAxisIndex: 0 }, categories[index - 1]) : undefined;
    const bottomCenter = index < categories.length - 1 ? (ec as any).convertToPixel({ yAxisIndex: 0 }, categories[index + 1]) : undefined;
    let halfStep = 0;
    if (topCenter !== undefined && bottomCenter !== undefined) {
      halfStep = Math.min(Math.abs(centerPx - topCenter), Math.abs(bottomCenter - centerPx)) / 2;
    } else if (bottomCenter !== undefined) {
      halfStep = Math.abs(bottomCenter - centerPx) / 2;
    } else if (topCenter !== undefined) {
      halfStep = Math.abs(centerPx - topCenter) / 2;
    } else {
      try {
        const yAxisModel = (ec as any).getModel().getComponent('yAxis', 0);
        const axis = yAxisModel?.axis;
        const bw = axis?.getBandWidth ? axis.getBandWidth() : 40;
        const testBottom = (ec as any).convertToPixel({ yAxisIndex: 0 }, categories[index]);
        const testTop = testBottom - (bw || 40);
        halfStep = Math.abs(testBottom - testTop) / 2;
      } catch { halfStep = 20; }
    }

    const coord0 = centerPx - halfStep;
    const coord1 = centerPx + halfStep;
    const grid = (ec as any).getModel().getComponent('grid', 0);
    let leftPx = 0, rightPx = 0;
    try {
      const rect = grid?.coordinateSystem?.getRect();
      leftPx = rect?.x ?? 0; 
      rightPx = (rect?.x ?? 0) + (rect?.width ?? 0);
    } catch {}
    // For horizontal bars: coord0/coord1 are Y coordinates (top/bottom of band)
    const topPx = Math.min(coord0, coord1) - expandY;
    const bottomPx = Math.max(coord0, coord1) + expandY;
    const width = Math.max(0, (rightPx - leftPx) + expandX);
    const height = Math.max(0, bottomPx - topPx);
    const rectX = leftPx - expandX;
    const rectY = topPx;
    return { x: rectX, y: rectY, width, height };
  } catch {
    return null;
  }
}
