export function mapLabelPosition(pos: string): any {
  switch (pos) {
    case 'insideEnd': return 'insideTop';
    case 'outsideEnd': return 'top';
    case 'insideCenter': return 'inside';
    case 'insideBase': return 'insideBottom';
    case 'auto':
    default: return 'top';
  }
}

export function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'number' ? v : Number(v);
}

export interface AxisValueFormatOptions {
  valueType: string;          // auto|number|currency|percent
  displayUnits: string;       // auto|none|thousands|millions|billions|trillions
  decimals: string;           // auto|0..9
  culture?: string;           // optional culture for Intl
  currencyCode?: string;      // optional currency code if valueType=currency
  sourceFormat?: string;      // Power BI format string from source (e.g., "$#,0.00")
}

function unitDivisor(units: string, maxValue: number): { divisor: number; suffix: string } {
  const map: Record<string, { divisor: number; suffix: string }> = {
    none: { divisor: 1, suffix: '' },
    thousands: { divisor: 1e3, suffix: 'K' },
    millions: { divisor: 1e6, suffix: 'M' },
    billions: { divisor: 1e9, suffix: 'B' },
    trillions: { divisor: 1e12, suffix: 'T' }
  };
  if (units === 'auto') {
    if (maxValue >= 1e12) return map.trillions;
    if (maxValue >= 1e9) return map.billions;
    if (maxValue >= 1e6) return map.millions;
    if (maxValue >= 1e3) return map.thousands;
    return map.none;
  }
  return map[units] || map.none;
}

export function formatAxisValue(v: number, maxValue: number, opts: AxisValueFormatOptions): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '';
  
  // If valueType is "auto" and we have a Power BI source format, use it
  if (opts.valueType === 'auto' && opts.sourceFormat) {
    try {
      // Try to infer format from Power BI format string
      return formatWithPowerBIFormat(v, opts.sourceFormat, opts.displayUnits, maxValue, opts.decimals);
    } catch {
      // Fall through to manual formatting
    }
  }
  
  const { divisor, suffix } = unitDivisor(opts.displayUnits, maxValue);
  const base = v / divisor;
  // Decide decimals
  let dec: number | undefined = undefined;
  if (opts.decimals !== 'auto') dec = Math.max(0, Math.min(9, Number(opts.decimals)));
  // Currency / percent / number
  const style = opts.valueType === 'currency' ? 'currency'
    : (opts.valueType === 'percent' ? 'percent' : 'decimal');
  const culture = opts.culture || undefined;
  const currency = opts.valueType === 'currency' ? (opts.currencyCode || 'USD') : undefined;
  // Percent expects raw fraction; if user chooses percent assume input already numeric value (e.g. 0.25) so multiply when formatting?
  let valueForFormat = base;
  if (style === 'percent') {
    // If values look already large ( > 1 ) we assume they are absolute and not fractions; skip multiply.
    if (Math.abs(base) <= 1) {
      valueForFormat = base; // treat as fraction
    } else {
      // treat as absolute number; convert to fraction
      valueForFormat = base / 100;
    }
  }
  try {
    const fmt = new Intl.NumberFormat(culture, {
      style: style === 'decimal' ? 'decimal' : style,
      ...(currency ? { currency } : {}),
      minimumFractionDigits: dec !== undefined ? dec : undefined,
      maximumFractionDigits: dec !== undefined ? dec : undefined
    });
    const formatted = fmt.format(valueForFormat);
    return suffix ? `${formatted}${suffix}` : formatted;
  } catch {
    // Fallback
    const fixed = dec !== undefined ? valueForFormat.toFixed(dec) : String(valueForFormat);
    return suffix ? `${fixed}${suffix}` : fixed;
  }
}

/**
 * Format value using Power BI format string
 */
function formatWithPowerBIFormat(v: number, format: string, displayUnits: string, maxValue: number, decimals: string): string {
  // When using source format with auto settings, don't apply display units - respect the original format
  let divisor = 1;
  let suffix = '';
  
  // Only apply display units if explicitly set (not auto)
  if (displayUnits !== 'auto') {
    const unit = unitDivisor(displayUnits, maxValue);
    divisor = unit.divisor;
    suffix = unit.suffix;
  }
  
  const base = v / divisor;
  
  // Detect format type from Power BI format string
  const isCurrency = format.includes('$') || format.includes('€') || format.includes('£');
  const isPercent = format.includes('%');
  
  // Extract decimal places from format if decimals is auto
  let dec: number | undefined = undefined;
  if (decimals !== 'auto') {
    dec = Math.max(0, Math.min(9, Number(decimals)));
  } else {
    // Try to infer from format string (count zeros after decimal point)
    const decimalMatch = format.match(/\.0+/);
    if (decimalMatch) {
      dec = decimalMatch[0].length - 1; // -1 for the dot
    }
  }
  
  let valueForFormat = base;
  let style: string = 'decimal';
  let currency: string | undefined = undefined;
  
  if (isCurrency) {
    style = 'currency';
    // Try to detect currency from format
    if (format.includes('$')) currency = 'USD';
    else if (format.includes('€')) currency = 'EUR';
    else if (format.includes('£')) currency = 'GBP';
    else currency = 'USD';
  } else if (isPercent) {
    style = 'percent';
    // Power BI percent formats usually store as 0-1 fraction
    valueForFormat = base;
  }
  
  try {
    const fmt = new Intl.NumberFormat(undefined, {
      style: style as any,
      ...(currency ? { currency } : {}),
      minimumFractionDigits: dec !== undefined ? dec : undefined,
      maximumFractionDigits: dec !== undefined ? dec : undefined
    });
    const formatted = fmt.format(valueForFormat);
    return suffix ? `${formatted}${suffix}` : formatted;
  } catch {
    // Fallback
    const fixed = dec !== undefined ? valueForFormat.toFixed(dec) : String(valueForFormat);
    return suffix ? `${fixed}${suffix}` : fixed;
  }
}
