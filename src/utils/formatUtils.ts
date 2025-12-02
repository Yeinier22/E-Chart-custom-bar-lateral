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
