// Dual Axis Manager: Handles primary and secondary Y-axis configuration
// Separates series into primary and secondary axes based on configuration

export interface AxisConfiguration {
  show: boolean;
  labelColor: string;
  labelSize: number;
  fontFamily: string;
  fontStyle: string;
  fontWeight: string;
  showGridLines: boolean;
  min?: number;
  max?: number;
  splitNumber?: number;
  interval?: number;
  labelFormatter?: (value: any) => string;
}

export interface DualAxisResult {
  yAxis: any[];
  hasSecondaryAxis: boolean;
}

/**
 * Checks if any series uses the secondary axis
 */
export function hasSecondaryAxisSeries(series: any[]): boolean {
  return series.some(s => s.yAxisIndex === 1);
}

/**
 * Creates dual Y-axis configuration for ECharts
 * @param primaryConfig Configuration for primary Y-axis
 * @param secondaryConfig Configuration for secondary Y-axis
 * @param series Array of series to check if secondary axis is needed
 */
export function createDualAxisConfig(
  primaryConfig: AxisConfiguration,
  secondaryConfig: AxisConfiguration,
  series: any[]
): DualAxisResult {
  const hasSecondary = hasSecondaryAxisSeries(series);
  
  const primaryAxis = {
    type: 'value',
    position: 'left',
    axisLabel: {
      show: primaryConfig.show,
      fontSize: primaryConfig.labelSize,
      color: primaryConfig.labelColor,
      fontFamily: primaryConfig.fontFamily,
      fontStyle: primaryConfig.fontStyle,
      fontWeight: primaryConfig.fontWeight,
      margin: 8,
      ...(primaryConfig.labelFormatter ? { formatter: primaryConfig.labelFormatter } : {})
    },
    splitLine: { show: primaryConfig.showGridLines },
    ...(typeof primaryConfig.min === 'number' ? { min: primaryConfig.min } : {}),
    ...(typeof primaryConfig.max === 'number' ? { max: primaryConfig.max } : {}),
    ...(primaryConfig.splitNumber ? { splitNumber: primaryConfig.splitNumber } : {}),
    ...(primaryConfig.interval ? { interval: primaryConfig.interval } : {})
  };

  if (!hasSecondary) {
    return {
      yAxis: [primaryAxis],
      hasSecondaryAxis: false
    };
  }

  const secondaryAxis = {
    type: 'value',
    position: 'right',
    axisLabel: {
      show: secondaryConfig.show,
      fontSize: secondaryConfig.labelSize,
      color: secondaryConfig.labelColor,
      fontFamily: secondaryConfig.fontFamily,
      fontStyle: secondaryConfig.fontStyle,
      fontWeight: secondaryConfig.fontWeight,
      margin: 8,
      ...(secondaryConfig.labelFormatter ? { formatter: secondaryConfig.labelFormatter } : {})
    },
    splitLine: { show: false }, // Don't show grid lines for secondary to avoid clutter
    ...(typeof secondaryConfig.min === 'number' ? { min: secondaryConfig.min } : {}),
    ...(typeof secondaryConfig.max === 'number' ? { max: secondaryConfig.max } : {}),
    ...(secondaryConfig.splitNumber ? { splitNumber: secondaryConfig.splitNumber } : {}),
    ...(secondaryConfig.interval ? { interval: secondaryConfig.interval } : {})
  };

  return {
    yAxis: [primaryAxis, secondaryAxis],
    hasSecondaryAxis: true
  };
}

/**
 * Computes scale for secondary axis series only
 * @param series All series in the chart
 * @param options Scale computation options
 */
export function computeSecondaryAxisScale(series: any[], options: any): any {
  // Filter only secondary axis series
  const secondarySeries = series.filter(s => s.yAxisIndex === 1);
  
  if (secondarySeries.length === 0) {
    return { min: undefined, max: undefined, splitNumber: undefined, interval: undefined, labelFormatter: undefined };
  }

  // Gather all numeric values from secondary series
  let minY: number | undefined = undefined;
  let maxY: number | undefined = undefined;
  
  for (const s of secondarySeries) {
    const arr = Array.isArray(s.data) ? s.data : [];
    for (const v of arr) {
      const num = typeof v === 'number' ? v : (v?.value ?? v);
      if (typeof num === 'number' && isFinite(num)) {
        if (minY === undefined || num < minY) minY = num;
        if (maxY === undefined || num > maxY) maxY = num;
      }
    }
  }

  if (minY === undefined || maxY === undefined) {
    return { min: undefined, max: undefined, splitNumber: undefined, interval: undefined, labelFormatter: undefined };
  }

  // Use similar logic to primary axis
  const tolerance = options.tolerance || 0;
  const userSplits = options.userSplits || 0;
  
  const range = maxY - minY;
  const adjustedMax = maxY + (range * tolerance * 0.5);
  
  // Start from 0 if minimum is non-negative (like primary axis)
  const computedMin = minY >= 0 ? 0 : minY - (range * 0.1);
  
  let splitNumber = userSplits > 0 ? userSplits : undefined;
  let interval = undefined;
  
  if (userSplits > 0 && range > 0) {
    interval = (adjustedMax - computedMin) / userSplits;
  }

  return {
    min: computedMin,
    max: adjustedMax,
    splitNumber,
    interval,
    labelFormatter: options.labelFormatter
  };
}
