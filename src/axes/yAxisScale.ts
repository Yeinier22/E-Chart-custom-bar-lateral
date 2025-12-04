import { formatAxisValue } from "../utils/formatUtils";

const allowedFractions = [1, 1.2, 1.5, 2, 2.5, 3, 5, 10];

function niceStep(raw: number): number {
  if (!isFinite(raw) || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const frac = raw / Math.pow(10, exp);
  const tolerance = 1e-9;
  for (const a of allowedFractions) {
    if (Math.abs(frac - a) < tolerance) return a * Math.pow(10, exp);
  }
  for (const a of allowedFractions) {
    if (a >= frac) return a * Math.pow(10, exp);
  }
  return 10 * Math.pow(10, exp);
}

export interface YAxisSettings {
  tolerance: number;       // 0..1 headroom control
  userSplits: number;      // 0 = auto, >0 fixed gridlines
  valueType: string;       // auto|number|currency|percent
  displayUnits: string;    // auto|none|thousands|millions|...
  decimals: string;        // auto|0..9
  currencyCode?: string;   // default USD
  sourceFormat?: string;   // Power BI format string from source
}

export interface YAxisResult {
  min?: number;
  max?: number;
  splitNumber: number;
  interval?: number;
  labelFormatter: (v: number) => string;
}

function scanMinMaxFromSeries(series: any[]): { min?: number; max?: number } {
  let minY: number | undefined;
  let maxY: number | undefined;
  for (const s of series || []) {
    const data = Array.isArray(s?.data) ? s.data : [];
    for (const v of data) {
      const num = typeof v === 'number' ? v : (v?.value ?? v);
      if (typeof num === 'number' && isFinite(num)) {
        if (minY === undefined || num < minY) minY = num;
        if (maxY === undefined || num > maxY) maxY = num;
      }
    }
  }
  return { min: minY, max: maxY };
}

export function computeYAxisScale(series: any[], settings: YAxisSettings): YAxisResult {
  const { min: minY, max: maxY } = scanMinMaxFromSeries(series);
  
  // If no data, return sensible defaults
  if (minY === undefined || maxY === undefined) {
    return {
      min: 0,
      max: 100,
      splitNumber: 5,
      interval: undefined,
      labelFormatter: (v: number) => formatAxisValue(v, 100, {
        valueType: settings.valueType,
        displayUnits: settings.displayUnits,
        decimals: settings.decimals,
        currencyCode: settings.currencyCode || 'USD',
        sourceFormat: settings.sourceFormat
      })
    };
  }
  
  const rangeY = maxY - minY;

  const targetSplits = (() => {
    if (settings.userSplits > 0) return Math.max(1, Math.round(settings.userSplits));
    const t = Math.max(0, Math.min(1, settings.tolerance));
    if (t <= 0.05) return 6;
    if (t <= 0.25) return 5;
    if (t <= 0.50) return 4;
    if (t <= 0.75) return 3;
    return 3;
  })();

  let yMin: number | undefined;
  let yMax: number | undefined;
  let splitNumber = targetSplits;
  let interval: number | undefined;

  if (rangeY !== undefined && rangeY > 0) {
    const proposedMax = maxY + rangeY * Math.max(0, Math.min(1, settings.tolerance)) * 0.5;
    if (settings.userSplits > 0) {
      // For user-defined splits, start from 0 if minY >= 0, otherwise adjust proportionally
      yMin = minY >= 0 ? 0 : minY - (rangeY * 0.1);
      const rawStep = maxY / targetSplits;
      const exp = Math.floor(Math.log10(rawStep));
      const frac = rawStep / Math.pow(10, exp);
      const stepFrac = allowedFractions.find(a => a >= frac) ?? 10;
      interval = stepFrac * Math.pow(10, exp);
      yMax = interval * targetSplits;
      splitNumber = targetSplits;
    } else {
      // For automatic splits, start from 0 if minY >= 0, otherwise adjust proportionally
      yMin = minY >= 0 ? 0 : minY - (rangeY * 0.1);
      const rawStep = proposedMax / targetSplits;
      const step = niceStep(rawStep);
      const maxCandidate = step * targetSplits;
      yMax = maxCandidate < proposedMax ? step * (targetSplits + 1) : maxCandidate;
      splitNumber = maxCandidate < proposedMax ? (targetSplits + 1) : targetSplits;
    }
  } else {
    // If range is 0 or negative, set defaults
    yMin = 0;
    yMax = maxY > 0 ? maxY * 1.2 : 100;
    splitNumber = 5;
  }

  const labelFormatter = (val: number) => formatAxisValue(val, (yMax ?? maxY ?? 0), {
    valueType: settings.valueType,
    displayUnits: settings.displayUnits,
    decimals: settings.decimals,
    currencyCode: settings.currencyCode || 'USD',
    sourceFormat: settings.sourceFormat
  });

  return { min: yMin, max: yMax, splitNumber, interval, labelFormatter };
}

export { niceStep };
