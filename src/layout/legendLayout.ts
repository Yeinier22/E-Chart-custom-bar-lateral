export interface LegendLayoutResult {
  isVertical: boolean;
  top?: any; bottom?: any; left?: any; right?: any;
  gridBottom: string;
}

// Computes legend placement and grid bottom margin based on settings and drill state.
// Mirrors the logic currently used in visual.ts but centralized.
export function computeLegendLayout(legendSettings: any, isDrilled: boolean): LegendLayoutResult {
  const show: boolean = legendSettings?.show !== false;
  const pos: string = legendSettings?.position || 'top';
  const align: string = legendSettings?.alignment || 'center';
  const extra: number = typeof legendSettings?.extraMargin === 'number' ? legendSettings.extraMargin : 0;
  const isVertical = pos === 'left' || pos === 'right';

  let top: any = undefined, bottom: any = undefined, left: any = undefined, right: any = undefined;

  if (pos === 'top' || pos === 'bottom' || pos === 'topCenter' || pos === 'bottomCenter') {
    const topBase = isDrilled ? 8 : 5;
    const bottomBase = isDrilled ? 10 : 5;
    if (pos === 'top' || pos === 'topCenter') top = `${topBase + extra}%`;
    if (pos === 'bottom' || pos === 'bottomCenter') bottom = `${bottomBase + extra}%`;

    if (align === 'left') left = '2%';
    else if (align === 'right') right = '2%';
    else left = 'center';
  } else if (pos === 'left') {
    left = '2%';
    top = '5%';
  } else if (pos === 'right') {
    right = '2%';
    top = '5%';
  } else if (pos === 'bottomRight') {
    const b = isDrilled ? 10 : 5;
    bottom = `${b + extra}%`;
    right = '2%';
  }

  const gridBottom = (!show)
    ? '3%'
    : ((pos === 'bottom' || pos === 'bottomCenter' || pos === 'bottomRight')
        ? `${(isDrilled ? 16 : 12) + extra}%`
        : '3%');

  return { isVertical, top, bottom, left, right, gridBottom };
}
