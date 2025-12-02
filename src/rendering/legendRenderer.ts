// Placeholder for custom legend rendering/helpers
export interface LegendIconConfig { icon?: string; width: number; height: number }

export function normalizeLegendShape(value: any): 'default' | 'circle' | 'square' | 'rhombus' | 'triangle' | 'triangleDown' {
  if (typeof value !== 'string') return 'default';
  const lower = value.toLowerCase();
  switch (lower) {
    case 'circle': return 'circle';
    case 'square': return 'square';
    case 'rect':
    case 'rectangle': return 'default';
    case 'rhombus':
    case 'diamond': return 'rhombus';
    case 'triangle': return 'triangle';
    case 'triangledown':
    case 'triangle-down':
    case 'triangle_down':
    case 'triangle (upside down)': return 'triangleDown';
    default: return 'default';
  }
}

export function legendIconForShape(shape: ReturnType<typeof normalizeLegendShape>, size: number): LegendIconConfig {
  const base = Math.max(4, Number.isFinite(size) ? size : 14);
  switch (shape) {
    case 'circle': return { icon: 'circle', width: base, height: base };
    case 'square': return { icon: 'rect', width: base, height: base };
    case 'rhombus': return { icon: 'diamond', width: base, height: base };
    case 'triangle': return { icon: 'triangle', width: base, height: base };
    case 'triangleDown': return { icon: 'path://M0,0 L10,0 L5,10 Z', width: base, height: base };
    case 'default':
    default: return { icon: undefined, width: Math.max(4, base * 1.4), height: base };
  }
}
