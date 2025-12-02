export function ensureSolidColor(color: string | undefined, fallback: string = '#66aaff'): string {
  if (!color) return fallback;
  const c = color.trim();
  const mRgba = c.match(/^rgba\s*\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*\d*\.?\d+\s*)\)/i);
  if (mRgba) {
    const r = parseInt(mRgba[1]);
    const g = parseInt(mRgba[2]);
    const b = parseInt(mRgba[3]);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const mRgb = c.match(/^rgb\s*\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)/i);
  if (mRgb) return c;
  if (c[0] === '#') {
    const hex = c.replace('#','');
    if (hex.length === 4 || hex.length === 8) {
      if (hex.length === 4) {
        const r = parseInt(hex[0]+hex[0],16);
        const g = parseInt(hex[1]+hex[1],16);
        const b = parseInt(hex[2]+hex[2],16);
        return `rgb(${r}, ${g}, ${b})`;
      }
      const r = parseInt(hex.substring(0,2),16);
      const g = parseInt(hex.substring(2,4),16);
      const b = parseInt(hex.substring(4,6),16);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return c;
}
