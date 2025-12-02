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
    const centerPx = (ec as any).convertToPixel({ xAxisIndex: 0 }, categories[index]);
    const leftCenter = index > 0 ? (ec as any).convertToPixel({ xAxisIndex: 0 }, categories[index - 1]) : undefined;
    const rightCenter = index < categories.length - 1 ? (ec as any).convertToPixel({ xAxisIndex: 0 }, categories[index + 1]) : undefined;
    let halfStep = 0;
    if (leftCenter !== undefined && rightCenter !== undefined) {
      halfStep = Math.min(Math.abs(centerPx - leftCenter), Math.abs(rightCenter - centerPx)) / 2;
    } else if (rightCenter !== undefined) {
      halfStep = Math.abs(rightCenter - centerPx) / 2;
    } else if (leftCenter !== undefined) {
      halfStep = Math.abs(centerPx - leftCenter) / 2;
    } else {
      try {
        const xAxisModel = (ec as any).getModel().getComponent('xAxis', 0);
        const axis = xAxisModel?.axis;
        const bw = axis?.getBandWidth ? axis.getBandWidth() : 40;
        const testRight = (ec as any).convertToPixel({ xAxisIndex: 0 }, categories[index]);
        const testLeft = testRight - (bw || 40);
        halfStep = Math.abs(testRight - testLeft) / 2;
      } catch { halfStep = 20; }
    }

    const coord0 = centerPx - halfStep;
    const coord1 = centerPx + halfStep;
    const grid = (ec as any).getModel().getComponent('grid', 0);
    let topPx = 0, bottomPx = 0;
    try {
      const rect = grid?.coordinateSystem?.getRect();
      topPx = rect?.y ?? 0; bottomPx = (rect?.y ?? 0) + (rect?.height ?? 0);
    } catch {}
    const leftPx = Math.min(coord0, coord1) - expandX;
    const rightPx = Math.max(coord0, coord1) + expandX;
    const width = Math.max(0, rightPx - leftPx);
    const height = Math.max(0, (bottomPx - topPx) + expandY);
    const rectX = leftPx;
    const rectY = topPx - expandY;
    return { x: rectX, y: rectY, width, height };
  } catch {
    return null;
  }
}
