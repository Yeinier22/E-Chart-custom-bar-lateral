import powerbi from 'powerbi-visuals-api';
import { ColorHelper } from 'powerbi-visuals-utils-colorutils';
import { dataViewWildcard } from 'powerbi-visuals-utils-dataviewutils';
import { ParsedData } from './dataInterfaces';
import { VisualFormattingSettingsModel } from '../formatting';
import { DebugLogger } from '../utils/debugLogger';

export class DataViewParser {
  constructor(
    private host: powerbi.extensibility.IVisualHost,
    private populateFormatting: (modelCtor: any, dv: powerbi.DataView) => VisualFormattingSettingsModel,
    private debugLogger?: DebugLogger
  ) {}

  public parse(dv: powerbi.DataView | undefined, seriesColors: { [key: string]: string }): ParsedData {
    const empty: ParsedData = {
      categories: [],
      legendNames: [],
      series: [],
      seriesColors: seriesColors,
      formatting: {} as any,
      dataView: dv as any,
      hasData: false
    };
    if (!dv || !dv.categorical) return empty;

    const formatting = this.populateFormatting(VisualFormattingSettingsModel, dv);

    const categorical = dv.categorical;
    const categoryCols = categorical.categories || [];
    const cat1All = categoryCols[0]?.values || [];
    const rowCount = cat1All.length || 0;

    // Aggregate by first category
    const uniqueCat1: any[] = [];
    const idxsByCat1 = new Map<any, number[]>();
    for (let i = 0; i < rowCount; i++) {
      const v = (cat1All as any[])[i];
      if (!idxsByCat1.has(v)) {
        idxsByCat1.set(v, []);
        uniqueCat1.push(v);
      }
      idxsByCat1.get(v)!.push(i);
    }

    // Check if there's sorting information in metadata
    const sortInfo = categorical.values?.[0]?.source?.sort;

    // Apply category limit if enabled
    let finalUniqueCat1 = uniqueCat1;
    if (formatting.dataOptionsCard.limitCategories.value) {
      const maxCat = formatting.dataOptionsCard.maxCategories.value;
      if (maxCat > 0 && uniqueCat1.length > maxCat) {
        finalUniqueCat1 = uniqueCat1.slice(0, maxCat);
      }
    }

    const valuesCols: any = categorical.values || [];

    const colorHelper = new ColorHelper((this.host as any).colorPalette, {
      objectName: 'dataPoint',
      propertyName: 'fill',
    } as any);

    const toNumber = (x: any) => x === null || x === undefined || x === '' ? 0 : (typeof x === 'number' ? x : Number(x));

    const legendNames: string[] = [];
    const series: any[] = [];
    
    // Track aggregated values for sorting
    const categoryAggregates: Map<string, number> = new Map();

    const getUserColorFromMeta = (seriesName: string): string | undefined => {
      const objects: any = dv?.metadata?.objects || {};
      const dataPoint: any = objects['dataPoint'] || {};
      const userColorMeta: string | undefined = dataPoint?.[seriesName]?.solid?.color
        ?? dataPoint?.[seriesName]?.fill?.solid?.color;
      return userColorMeta;
    };

    const resolveSeriesColor = (seriesName: string): string => {
      const userColor = getUserColorFromMeta(seriesName);
      const color = userColor || seriesColors[seriesName] || (colorHelper.getColorForSeriesValue(dv?.metadata?.objects as any, seriesName) as any);
      seriesColors[seriesName] = color;
      return color || '#3366CC';
    };

    // Filter only series1-series5 measures, skip labelVisibility
    const measures: any[] = (valuesCols as any[]) || [];
    const seriesMeasures = measures.filter((mv: any) => {
      const roles = mv?.source?.roles;
      if (!roles) return false;
      // Check if it's one of our series roles (not labelVisibility)
      return roles.series1 || roles.series2 || roles.series3 || roles.series4 || roles.series5;
    });

    // Remove duplicates by measure name (for Field Parameters)
    const seenNames = new Set<string>();
    const uniqueSeriesMeasures = seriesMeasures.filter((mv: any) => {
      const name = mv?.source?.displayName ?? '';
      if (seenNames.has(name)) {
        return false; // Skip duplicate
      }
      seenNames.add(name);
      return true;
    });

    for (let idx = 0; idx < uniqueSeriesMeasures.length; idx++) {
      const mv: any = uniqueSeriesMeasures[idx];
      const name = mv?.source?.displayName ?? `Series ${idx + 1}`;
      const color = resolveSeriesColor(name);
      
      // Read series config settings
      const seriesConfig = mv?.source?.objects?.seriesConfig || {};
      const fillColor = seriesConfig?.fillColor?.solid?.color || color;
      const lineColor = seriesConfig?.lineColor?.solid?.color || fillColor;
      const lineType = seriesConfig?.lineType || 'solid';
      const lineWidth = typeof seriesConfig?.lineWidth === 'number' ? seriesConfig.lineWidth : 2;
      const lineOpacity = typeof seriesConfig?.lineOpacity === 'number' ? seriesConfig.lineOpacity / 100 : 1;
      const scaleFactor = typeof seriesConfig?.scaleFactor === 'number' ? seriesConfig.scaleFactor : 1;
      
      const src: any[] = mv?.values || [];
      const high: any[] | undefined = mv?.highlights as any[] | undefined;
      const agg = finalUniqueCat1.map((c) => {
        const idxs = idxsByCat1.get(c) || [];
        let s = 0; for (const i of idxs) s += toNumber(src[i]);
        return s;
      });
      
      // Track aggregated values for the first series (used for sorting)
      if (idx === 0) {
        finalUniqueCat1.forEach((cat, i) => {
          categoryAggregates.set(cat, agg[i]);
        });
      }
      
      const aggHigh = Array.isArray(high)
        ? finalUniqueCat1.map((c) => {
            const idxs = idxsByCat1.get(c) || [];
            let s = 0; for (const i of idxs) s += toNumber(high[i]);
            return s;
          })
        : undefined;
      const useHighlights = Array.isArray(aggHigh) && (aggHigh as number[]).some(v => v !== null && v !== undefined && Number(v) !== 0);
      legendNames.push(name);
      
      // Apply scale factor to data if not 1
      let finalData = useHighlights ? (aggHigh as number[]) : agg;
      if (scaleFactor !== 1) {
        finalData = finalData.map(v => typeof v === 'number' ? v * scaleFactor : v);
      }
      
      // Apply colors and border styles to series
      series.push({ 
        name, 
        type: 'bar', 
        data: finalData, 
        itemStyle: { 
          color: fillColor,
          borderColor: lineColor,
          borderWidth: lineWidth,
          borderType: lineType,
          opacity: 1
        },
        emphasis: {
          itemStyle: {
            borderColor: lineColor,
            borderWidth: lineWidth,
            opacity: lineOpacity
          }
        },
        label: {} 
      });
    }

    // Apply internal sorting if sort is detected
    // SortDirection: 1 = ascending, 2 = descending
    if (sortInfo === 1 || sortInfo === 2) {
      const isAscending = sortInfo === 1;
      
      // Create array of {category, value, index} for sorting
      const categoryData = finalUniqueCat1.map((cat, index) => ({
        category: cat,
        value: categoryAggregates.get(cat) || 0,
        originalIndex: index
      }));
      
      // Sort by value
      categoryData.sort((a, b) => {
        return isAscending ? (a.value - b.value) : (b.value - a.value);
      });
      
      // Extract sorted categories
      const sortedCategories = categoryData.map(item => item.category);
      
      // Reorder all series data to match sorted categories
      series.forEach(s => {
        const oldData = [...s.data];
        s.data = categoryData.map(item => oldData[item.originalIndex]);
      });
      
      // Update finalUniqueCat1 to sorted order
      finalUniqueCat1 = sortedCategories;
    }

    return {
      categories: finalUniqueCat1,
      legendNames,
      series,
      seriesColors,
      formatting,
      dataView: dv,
      hasData: finalUniqueCat1.length > 0 && series.length > 0
    };
  }
}
