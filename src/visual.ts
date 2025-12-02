/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
"use strict";

import * as echarts from "echarts";
import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./formatting";
import { bindHoverHandlers, drawSelectionBand, updateDrillGraphics } from "./interaction/hoverHandlers";
import { buildSelectionIds } from "./interaction/selectionManager";
import { canDrillDown, canCategoryDrillDown, buildDrillForCategory as buildDrillForCategoryExternal, restoreBaseView as restoreBaseViewExternal, resetFullView as resetFullViewExternal, renderDrillView } from "./drill/drillHandler";
import { DataViewParser } from "./data/dataViewParser";
import { ParsedData } from "./data/dataInterfaces";
import { ensureSolidColor } from "./utils/colorUtils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { dataViewWildcard } from "powerbi-visuals-utils-dataviewutils";
import { ChartBuilder, BaseRenderParams, DrillRenderParams } from "./rendering/chartBuilder";
import { normalizeLegendShape, legendIconForShape } from "./rendering/legendRenderer";
import { computeLegendLayout } from "./layout/legendLayout";
import { buildLabelVisibilityMapForCat1 } from "./data/visibilityUtils";
import { computeBandRect } from "./rendering/overlayRenderer";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import "./../style/visual.less";
import { formatAxisValue } from "./utils/formatUtils";
import { computeYAxisScale } from "./axes/yAxisScale";
import { createDualAxisConfig, computeSecondaryAxisScale, AxisConfiguration } from "./axes/dualAxisManager";

// Ensure solid color (no alpha). If input has rgba/argb/hex with alpha, drop alpha.
// Deprecated local function replaced by ensureSolidColor in utils/colorUtils.ts

export class Visual implements powerbi.extensibility.IVisual {
  private chartContainer: HTMLDivElement;
  private chartInstance: echarts.ECharts;
  private chartBuilder: ChartBuilder;
  private host: powerbi.extensibility.IVisualHost;
  private selectionManager: ISelectionManager;
  private formattingSettings: VisualFormattingSettingsModel;
  private formattingSettingsService: FormattingSettingsService;
  private parser: DataViewParser;
  private parsed: ParsedData | undefined;
  private seriesColors: { [key: string]: string } = {};
  private dataView: powerbi.DataView | undefined;
  // Selection tracking
  private selectionIds: ISelectionId[] = [];
  private categorySelectionIds: { [key: string]: ISelectionId[] } = {};
  // Drilldown state
  private isDrilled: boolean = false;
  private baseCategories: any[] = [];
  private baseSeriesSnapshot: any[] = [];
  private baseLegendNames: string[] = [];
  private drillCategory: string | null = null;
  private drillCategoryKey: any = null;
  private hoverGraphic: any[] = [];
  private selectionGraphic: any[] = [];
  private selectedIndex: number | null = null;
  private currentCategories: any[] = [];
  // Drill level selection IDs
  private drillSelectionIds: { [key: string]: ISelectionId[] } = {};

  // Store last update options to force re-render on external selection changes
  private lastUpdateOptions: powerbi.extensibility.visual.VisualUpdateOptions | undefined;

  // Legend helpers removed; now imported from rendering/legendRenderer

  // Restore to base (drill-up)
  private restoreBaseView() { return restoreBaseViewExternal(this); }

  // Reset equals restore for 2-level drill
  private resetFullView() { return resetFullViewExternal(this); }

  // Check if drill down is possible
  private canDrillDown(): boolean { return canDrillDown(this); }

  // Check if a specific category can drill down
  private canCategoryDrillDown(categoryLabel: any, categoryKey?: any): boolean { return canCategoryDrillDown(this, categoryLabel, categoryKey); }

  // Simple delay to ensure selection propagation
  private ensureSelectionPropagation() {
    // Small delay to let Power BI process the selection
    setTimeout(() => {
      console.log("Selection propagation complete - other visuals should now be filtered");
      
      // Optional: Check current selection state
      this.logCurrentSelectionState();
    }, 50);
  }

  // Debug function to log current selection state
  private logCurrentSelectionState() {
    try {
      const currentSelections = this.selectionManager.getSelectionIds();
      console.log("Current selection IDs count:", (currentSelections as any)?.length || 0);
    } catch (error) {
      console.log("Could not retrieve current selection state");
    }
  }

  // Build selection IDs for drill level (subcategories)
  private buildDrillSelectionIds(clickedCategoryLabel: any, categoryKey?: any) {
    this.drillSelectionIds = {};

    const dataView = this.dataView;
    if (!dataView || !dataView.categorical) {
      return;
    }

    const categorical = dataView.categorical;
    const categoryCols = categorical.categories || [];
    const cat1 = categoryCols[0]?.values || [];
    const cat2 = categoryCols[1]?.values || [];
    
    if (!categoryCols[0] || !categoryCols[1] || !categoryCols[0].identity || !categoryCols[1].identity) {
      return;
    }

    const cat1Identity = categoryCols[0].identity || [];
    const cat2Identity = categoryCols[1].identity || [];

    const matchesCategory = (value: any) => {
      if (categoryKey !== undefined && categoryKey !== null) {
        if (value === categoryKey) return true;
        const valuePrimitive = (value !== null && value !== undefined && typeof value.valueOf === "function")
          ? value.valueOf() : value;
        const keyPrimitive = (categoryKey !== null && categoryKey !== undefined && typeof categoryKey.valueOf === "function")
          ? categoryKey.valueOf() : categoryKey;
        if (valuePrimitive === keyPrimitive) return true;
        if (String(valuePrimitive) === String(keyPrimitive)) return true;
      }
      if (value === clickedCategoryLabel) return true;
      if (value !== null && value !== undefined && clickedCategoryLabel !== null && clickedCategoryLabel !== undefined) {
        return String(value) === String(clickedCategoryLabel);
      }
      return false;
    };

    // Group all matching indices by subcategory value
    const subcategoryToIndices = new Map<any, number[]>();
    
    for (let i = 0; i < cat1.length; i++) {
      if (matchesCategory(cat1[i])) {
        const subcategoryValue = cat2[i];
        
        if (!subcategoryToIndices.has(subcategoryValue)) {
          subcategoryToIndices.set(subcategoryValue, []);
        }
        subcategoryToIndices.get(subcategoryValue)!.push(i);
      }
    }
    
    // Create selection IDs for each subcategory (include all series groups)
    const groups = (categorical.values as any)?.grouped?.() as any[] | undefined;
    for (const [subcategoryValue, indices] of subcategoryToIndices) {
      const idsForSubcategory: ISelectionId[] = [];
      try {
        for (const rowIndex of indices) {
          if (Array.isArray(groups) && groups.length > 0) {
            for (const g of groups) {
              const builder = (this.host as any).createSelectionIdBuilder();
              const id = builder
                .withCategory(categoryCols[0], rowIndex)
                .withCategory(categoryCols[1], rowIndex)
                .withSeries(categorical.values, g)
                .createSelectionId();
              idsForSubcategory.push(id);
            }
          } else {
            const builder = (this.host as any).createSelectionIdBuilder();
            const id = builder
              .withCategory(categoryCols[0], rowIndex)
              .withCategory(categoryCols[1], rowIndex)
              .createSelectionId();
            idsForSubcategory.push(id);
          }
        }
        this.drillSelectionIds[String(subcategoryValue)] = idsForSubcategory;
        console.log(`Created ${idsForSubcategory.length} drill selection IDs for subcategory: ${subcategoryValue}`);
      } catch (error) {
        console.warn("Failed to create drill selection IDs for subcategory:", subcategoryValue, error);
      }
    }
  }

  // updateDrillGraphics moved to interaction/hoverHandlers

  // drawSelectionBand moved to interaction/hoverHandlers

  private buildDrillForCategory(clickedCategoryLabel: any, categoryKey?: any): { categories: any[]; series: any[] } { return buildDrillForCategoryExternal(this, clickedCategoryLabel, categoryKey); }

  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.chartContainer = document.createElement("div");
    this.chartContainer.style.width = "100%";
    this.chartContainer.style.height = "100%";
    options.element.appendChild(this.chartContainer);
    this.chartBuilder = new ChartBuilder(this.chartContainer);
    this.chartInstance = this.chartBuilder.getInstance();
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.formattingSettingsService = new FormattingSettingsService();
    this.parser = new DataViewParser(this.host, (ctor, dv) => this.formattingSettingsService.populateFormattingSettingsModel(ctor, dv));
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions) {
    const dataView = options.dataViews && options.dataViews[0];
    this.dataView = dataView;
    this.lastUpdateOptions = options; // Store for potential re-render on external selection changes
    this.parsed = this.parser.parse(dataView, this.seriesColors);
    this.formattingSettings = this.parsed.formatting as VisualFormattingSettingsModel;
    if (!this.parsed.hasData) {
      this.chartInstance.clear();
      return;
    }

  const categorical = dataView!.categorical; // safe after hasData
    const categoryCols = categorical.categories || [];
    const cat1All = categoryCols[0]?.values || [];
    const cat2All = categoryCols[1]?.values || [];
    const rowCount = cat1All.length || 0;

    // Extract optional labelVisibility measure (DAX expression for showing/hiding labels)
    const valuesColsAll: any = categorical.values || [];
    let labelVisibilityValues: any[] | null = null;
    for (let i = 0; i < valuesColsAll.length; i++) {
      const col = valuesColsAll[i];
      if (col?.source?.roles?.labelVisibility) {
        labelVisibilityValues = col.values as any[];
        break;
      }
    }

    // Construir eje X: usar solo el primer nivel (Category[0]) con agregación por nivel
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
    // Use parsed categories
    const categories = (this.parsed?.categories && this.parsed.categories.length) ? this.parsed.categories : uniqueCat1;

    // Utilidad: normalizar valores a números o null
    const toNumberArray = (arr: any[]) =>
      (arr || []).map((v) =>
        v === null || v === undefined || v === ""
          ? null
          : typeof v === "number"
          ? v
          : Number(v)
      );

  let seriesData: any[] = [];
  let legendNames: string[] = [];
    const nameCount: Record<string, number> = {};
    const makeUniqueName = (raw: any): string => {
      let base = (raw === null || raw === undefined || String(raw) === "") ? "(Blank)" : String(raw);
      if (nameCount[base] === undefined) {
        nameCount[base] = 1;
        return base;
      } else {
        nameCount[base] += 1;
        return `${base} (${nameCount[base]})`;
      }
    };

    // Data Labels settings
    const dl: any = (dataView.metadata?.objects as any)?.dataLabels || {};
    const dlShow: boolean = dl["show"] !== false;
  const dlPositionSetting: string = dl["position"] || "auto";
  const dlShowBlankAs: string = (typeof dl["showBlankAs"] === "string") ? dl["showBlankAs"] : "";
  const dlTreatZeroAsBlank: boolean = dl["treatZeroAsBlank"] === true;
    const dlColor: string = (dl["color"] as any)?.solid?.color || "#444";
    const dlFontFamily: string = (dl["fontFamily"] as string) || "Segoe UI";
    const dlFontSize: number = typeof dl["fontSize"] === "number" ? dl["fontSize"] : 12;
    const dlFontStyleSetting: string = (dl["fontStyle"] as string) || "normal"; // normal|bold|italic
    const dlFontWeight: any = dlFontStyleSetting === "bold" ? "bold" : "normal";
    const dlFontStyle: any = dlFontStyleSetting === "italic" ? "italic" : "normal";
    const dlTransparency: number = typeof dl["transparency"] === "number" ? dl["transparency"] : 0;
    const dlOpacity: number = Math.max(0, Math.min(1, 1 - (dlTransparency / 100)));
    
    // Data Labels value formatting
    // Read dropdown values - they can come as objects {value: "...", displayName: "..."} or strings
    const dlValueType: string = (dl["valueType"] as any)?.value || dl["valueType"] || 'auto';
    const dlDisplayUnits: string = (dl["displayUnits"] as any)?.value || dl["displayUnits"] || 'auto';
    const dlDecimals: string = (dl["decimals"] as any)?.value || dl["decimals"] || 'auto';

    // Build labelVisibility lookup map: aggregate by category
    const labelVisibilityMap = (labelVisibilityValues && Array.isArray(labelVisibilityValues))
      ? buildLabelVisibilityMapForCat1(cat1All as any[], labelVisibilityValues)
      : new Map<any, number>();

    // Calculate max value across all series for label formatting
    let maxValueForLabels = 0;
    for (const s of seriesData) {
      if (Array.isArray(s.data)) {
        for (const d of s.data) {
          const num = typeof d === 'number' ? Math.abs(d) : (typeof d?.value === 'number' ? Math.abs(d.value) : 0);
          if (num > maxValueForLabels) maxValueForLabels = num;
        }
      }
    }

    const labelFormatterWithDAX = (params: any) => {
      // If labelVisibility measure is active, check it first
      if (labelVisibilityMap.size > 0) {
        const catName = params.name;
        const visValue = labelVisibilityMap.get(catName) ?? 0;
        if (visValue <= 0) {
          return "";
        }
      }
      const v = params?.value;
      if (v === null || v === undefined || v === "") {
        return dlShowBlankAs;
      }
      if (dlTreatZeroAsBlank) {
        const numeric = typeof v === "number" ? v : Number(v);
        if (!Number.isNaN(numeric) && numeric === 0) {
          return dlShowBlankAs ?? "";
        }
      }
      
      // Format value using formatAxisValue with data label settings
      const numericValue = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(numericValue)) {
        return formatAxisValue(numericValue, maxValueForLabels, {
          valueType: dlValueType,
          displayUnits: dlDisplayUnits,
          decimals: dlDecimals,
          currencyCode: 'USD'
        });
      }
      
      return v as any;
    };

    const mapLabelPosition = (pos: string): any => {
      switch (pos) {
        case "insideEnd": return "insideTop"; // near end inside (vertical bars)
        case "outsideEnd": return "top";     // outside end
        case "insideCenter": return "inside";
        case "insideBase": return "insideBottom";
        case "auto":
        default: return "top";
      }
    };
    const dlPosition = mapLabelPosition(dlPositionSetting);

    // Use parsed results for series and legend
    seriesData = (this.parsed?.series as any[]) || [];
    legendNames = (this.parsed?.legendNames as any[]) || [];

    // Apply series configuration (type, visibility, display name)
    const valuesCols: any = categorical.values || [];
    
    // Filter only series1-series5 measures, skip labelVisibility
    const measures: any[] = (valuesCols as any[]) || [];
    const seriesMeasures = measures.filter((mv: any) => {
      const roles = mv?.source?.roles;
      if (!roles) return false;
      return roles.series1 || roles.series2 || roles.series3 || roles.series4 || roles.series5;
    });
    
    seriesData = seriesData.map((s: any, idx: number) => {
      let config: any = {};
      
      // Read configuration from the measure
      if (seriesMeasures[idx]) {
        config = seriesMeasures[idx]?.source?.objects?.seriesConfig || {};
      }
      
      // Get chart type from configuration (default to 'bar')
      let chartType = config?.chartType || 'bar';
      
      // Get width percent (default to 100)
      let widthPercent = typeof config?.widthPercent === 'number' ? config.widthPercent : 100;
      
      // Get value axis (default to 'primary')
      let valueAxis = config?.valueAxis || 'primary';
      
      // Get scale factor (default to 1)
      let scaleFactor = typeof config?.scaleFactor === 'number' ? config.scaleFactor : 1;
      
      // Get scale factor mode (default to 'same')
      let scaleFactorMode = config?.scaleFactorMode || 'same';
      
      // Get individual scale factors for base and drill
      let scaleFactorBase = typeof config?.scaleFactorBase === 'number' ? config.scaleFactorBase : 1;
      let scaleFactorDrill = typeof config?.scaleFactorDrill === 'number' ? config.scaleFactorDrill : 1;
      
      // Get line width for line/area charts (default to 3)
      let symbolSize = typeof config?.symbolSize === 'number' ? config.symbolSize : 3;
      
      // Get show symbol for line/area charts (default to false)
      let showSymbol = config?.showSymbol !== undefined ? config.showSymbol : false;
      
      // Apply the type
      const updatedSeries: any = {
        ...s,
        type: chartType,
        yAxisIndex: valueAxis === 'secondary' ? 1 : 0
      };
      
      // Apply scale factor based on mode:
      // - "same": use scaleFactor for both base and drill
      // - "individual": use scaleFactorBase for base view
      let effectiveScaleFactor = scaleFactor;
      if (scaleFactorMode === 'individual') {
        effectiveScaleFactor = scaleFactorBase;
      }
      
      if (effectiveScaleFactor !== 1 && Array.isArray(updatedSeries.data)) {
        updatedSeries.data = updatedSeries.data.map((val: any) => {
          if (typeof val === 'number') {
            return val * effectiveScaleFactor;
          } else if (val && typeof val.value === 'number') {
            return { ...val, value: val.value * effectiveScaleFactor };
          }
          return val;
        });
      }
      
      // Apply bar width for bar/column charts
      if (chartType === 'bar') {
        updatedSeries.barWidth = `${widthPercent}%`;
      }
      
      // If type is 'line', make it smooth and apply line width
      if (chartType === 'line') {
        updatedSeries.smooth = 0.4; // Use numeric smoothing factor for better curves
        updatedSeries.lineStyle = {
          width: symbolSize,
          color: config?.lineColor?.solid?.color,
          type: config?.lineType === 'dashed' ? 'dashed' : config?.lineType === 'dotted' ? 'dotted' : 'solid',
          opacity: typeof config?.lineOpacity === 'number' ? config.lineOpacity / 100 : 1
        };
        updatedSeries.showSymbol = showSymbol;
      }
      
      // If type is 'area', need to set areaStyle, smooth, and line width
      if (chartType === 'area') {
        updatedSeries.type = 'line';
        updatedSeries.areaStyle = {};
        updatedSeries.smooth = 0.4; // Use numeric smoothing factor for better curves
        updatedSeries.lineStyle = {
          width: symbolSize,
          color: config?.lineColor?.solid?.color,
          type: config?.lineType === 'dashed' ? 'dashed' : config?.lineType === 'dotted' ? 'dotted' : 'solid',
          opacity: typeof config?.lineOpacity === 'number' ? config.lineOpacity / 100 : 1
        };
        updatedSeries.showSymbol = showSymbol;
      }
      
      // Check if series should be shown (only hide if explicitly set to false)
      if (config?.show === false) {
        // Hide series by making data empty but keep in legend
        updatedSeries.data = updatedSeries.data.map(() => null);
      }
      
      // Apply custom display name if provided
      if (config?.displayName && config.displayName !== s.name) {
        updatedSeries.name = config.displayName;
        // Update legend name too
        const legendIndex = legendNames.indexOf(s.name);
        if (legendIndex >= 0) {
          legendNames[legendIndex] = config.displayName;
        }
      }
      
      return updatedSeries;
    });

    // Use parsed base categories & series for initial render if still intact
    if (!categories.length || !seriesData.length) {
      this.chartInstance.clear();
      return;
    }

  // Build selection IDs for categories (includes all data points per category) via interaction module
  buildSelectionIds(this);

  // Hover style settings
  const hoverObj: any = (dataView.metadata?.objects as any)?.hoverStyle || {};
  const hoverColor: string = hoverObj?.color?.solid?.color || "#66aaff";
  const fillOpacityPct: number = typeof hoverObj?.fillOpacity === "number" ? hoverObj.fillOpacity
    : (typeof hoverObj?.opacity === "number" ? hoverObj.opacity : 30);
  const borderOpacityPct: number = typeof hoverObj?.borderOpacity === "number" ? hoverObj.borderOpacity : 50;
  const fillOpacity: number = Math.max(0, Math.min(1, fillOpacityPct / 100));
  const strokeOpacity: number = Math.max(0, Math.min(1, borderOpacityPct / 100));
  const hoverDuration: number = typeof hoverObj?.duration === "number" ? hoverObj.duration : 300;
  const hoverEasing: string = typeof hoverObj?.easing === "string" ? hoverObj.easing : "cubicOut";
  const hoverBorderColor: string = hoverObj?.borderColor?.solid?.color || "#00000020";
  const hoverBorderWidth: number = typeof hoverObj?.borderWidth === "number" ? hoverObj.borderWidth : 0;
  const expandX: number = typeof hoverObj?.expandX === "number" ? hoverObj.expandX : 8;
  const expandY: number = typeof hoverObj?.expandY === "number" ? hoverObj.expandY : 8;

  // We won't use item emphasis color, instead we draw a background band per category (xIndex) using axisPointer-like graphic on hover
  // but keep mild emphasis to avoid clash with selection styling.
  const seriesWithHover: any[] = (seriesData || []).map((s: any) => ({
    ...s,
    label: {
      ...(s.label || {}),
      show: dlShow,
      position: dlPosition,
      color: dlColor,
      fontFamily: dlFontFamily,
      fontSize: dlFontSize,
      fontStyle: dlFontStyle,
      fontWeight: dlFontWeight,
      formatter: labelFormatterWithDAX,
      opacity: dlOpacity
    },
    emphasis: {
      focus: undefined,
      scale: false
    },
    stateAnimation: { duration: hoverDuration, easing: hoverEasing }
  }));

  const xAxisSettings: any = (dataView.metadata?.objects as any)?.xAxis || {};
  const yAxisSettings: any = (dataView.metadata?.objects as any)?.yAxis || {};
  // X Axis toggles
  const showXAxisLine: boolean = xAxisSettings["showAxisLine"] !== false; // default true
  const showXLabels: boolean = xAxisSettings["showLabels"] !== false; // default true
  const xLabelColor: string = (xAxisSettings["labelColor"] as any)?.solid?.color || "#666666";
  const xLabelSize: number = (typeof xAxisSettings["labelSize"] === "number" ? xAxisSettings["labelSize"] : 12);
  const xRotateLabels: number = (typeof xAxisSettings["rotateLabels"] === "number" ? xAxisSettings["rotateLabels"] : 0);
  const xFontFamily: string = (xAxisSettings["fontFamily"] as string) || "Segoe UI, sans-serif";
  const xFontStyleSetting: string = (xAxisSettings["fontStyle"] as string) || "regular"; // regular|bold|italic|boldItalic
  const xFontWeight: any = (xFontStyleSetting === "bold" || xFontStyleSetting === "boldItalic") ? "bold" : "normal";
  const xFontStyle: any = (xFontStyleSetting === "italic" || xFontStyleSetting === "boldItalic") ? "italic" : "normal";
  let showXGridLines: boolean;
  if (typeof xAxisSettings["showGridLines"] === "boolean") {
    showXGridLines = xAxisSettings["showGridLines"];
  } else {
    showXGridLines = false; // default off for vertical grid lines to avoid clutter
  }
  // Y Axis toggles
  const showYLabels: boolean = yAxisSettings["showLabels"] !== false; // default true
  const yLabelColor: string = (yAxisSettings["labelColor"] as any)?.solid?.color || "#666666";
  const yLabelSize: number = (typeof yAxisSettings["labelSize"] === "number" ? yAxisSettings["labelSize"] : 12);
  const yFontFamily: string = (yAxisSettings["fontFamily"] as string) || "Segoe UI, sans-serif";
  const yFontStyleSetting: string = (yAxisSettings["fontStyle"] as string) || "regular";
  const yFontWeight: any = (yFontStyleSetting === "bold" || yFontStyleSetting === "boldItalic") ? "bold" : "normal";
  const yFontStyle: any = (yFontStyleSetting === "italic" || yFontStyleSetting === "boldItalic") ? "italic" : "normal";
  let showYGridLines: boolean;
  if (typeof yAxisSettings["showGridLines"] === "boolean") {
    showYGridLines = yAxisSettings["showGridLines"];
  } else if (typeof yAxisSettings["showGridlines"] === "boolean") {
    // legacy compatibility
    showYGridLines = yAxisSettings["showGridlines"];
  } else {
    showYGridLines = true; // horizontal grid lines on by default
  }

  // Y-axis scale adjustment tolerance: 0 = no extra headroom, 1 = ~50% headroom
  const yScaleAdjRaw = typeof yAxisSettings["scaleAdjustmentTolerance"] === "number" ? yAxisSettings["scaleAdjustmentTolerance"] : 0;
  const userSplitsRaw = typeof yAxisSettings["yAxisSplits"] === "number" ? yAxisSettings["yAxisSplits"] : 0;
  const valueTypeSetting: string = typeof yAxisSettings["valueType"] === 'string' ? yAxisSettings["valueType"] : 'auto';
  const displayUnitsSetting: string = typeof yAxisSettings["displayUnits"] === 'string' ? yAxisSettings["displayUnits"] : 'auto';
  const decimalsRaw: any = (yAxisSettings as any)["valueDecimals"];
  const decimalsSetting: string = (typeof decimalsRaw === 'number') ? String(decimalsRaw) : (typeof decimalsRaw === 'string' ? decimalsRaw : 'auto');
  const yScaleAdj = Math.max(0, Math.min(1, yScaleAdjRaw));
  // Gather all numeric values across series to derive min/max
  let minY: number | undefined = undefined;
  let maxY: number | undefined = undefined;
  for (const s of (seriesWithHover || [])) {
    const arr = Array.isArray(s.data) ? s.data : [];
    for (const v of arr) {
      const num = typeof v === 'number' ? v : (v?.value ?? v);
      if (typeof num === 'number' && isFinite(num)) {
        if (minY === undefined || num < minY) minY = num;
        if (maxY === undefined || num > maxY) maxY = num;
      }
    }
  }
  // Compute Y-axis layout using helper module
  // Compute Y-axis scale for primary axis (only primary axis series)
  const primarySeries = seriesWithHover.filter((s: any) => s.yAxisIndex === 0 || s.yAxisIndex === undefined);
  
  // Always ensure we have valid data for primary axis
  const primaryAxisData = primarySeries.length > 0 ? primarySeries : seriesWithHover;
  
  const yAxisScale = computeYAxisScale(primaryAxisData, {
    tolerance: yScaleAdj,
    userSplits: userSplitsRaw,
    valueType: valueTypeSetting,
    displayUnits: displayUnitsSetting,
    decimals: String(decimalsSetting),
    currencyCode: 'USD'
  });
  const yAxisMin = yAxisScale.min;
  const yAxisMax = yAxisScale.max;
  const ySplitNumber = yAxisScale.splitNumber;
  const axisLabelFormatter = showYLabels ? yAxisScale.labelFormatter : undefined;
  if (typeof yAxisScale.interval === 'number' && userSplitsRaw > 0) {
    (this as any)._fixedYAxisInterval = yAxisScale.interval;
  } else {
    (this as any)._fixedYAxisInterval = undefined;
  }

  // Compute secondary axis scale if needed
  // COMMENTED: Auto-scaling should be controlled manually via formatting options
  // const secondaryAxisScale = computeSecondaryAxisScale(seriesWithHover, {
  //   tolerance: yScaleAdj,
  //   userSplits: userSplitsRaw,
  //   labelFormatter: axisLabelFormatter
  // });

  // Create dual axis configuration
  const primaryAxisConfig: AxisConfiguration = {
    show: showYLabels,
    labelColor: yLabelColor,
    labelSize: yLabelSize,
    fontFamily: yFontFamily,
    fontStyle: yFontStyle,
    fontWeight: yFontWeight,
    showGridLines: showYGridLines,
    min: yAxisMin,
    max: yAxisMax,
    splitNumber: ySplitNumber,
    interval: (this as any)._fixedYAxisInterval,
    labelFormatter: axisLabelFormatter
  };

  // Use same configuration for secondary axis (should be controlled manually via formatting)
  const secondaryAxisConfig: AxisConfiguration = {
    show: showYLabels,
    labelColor: yLabelColor,
    labelSize: yLabelSize,
    fontFamily: yFontFamily,
    fontStyle: yFontStyle,
    fontWeight: yFontWeight,
    showGridLines: false, // Secondary axis doesn't show grid lines
    min: yAxisMin, // Use same min as primary
    max: yAxisMax, // Use same max as primary
    splitNumber: ySplitNumber, // Use same splits as primary
    interval: (this as any)._fixedYAxisInterval, // Use same interval as primary
    labelFormatter: axisLabelFormatter
  };

  const dualAxisResult = createDualAxisConfig(primaryAxisConfig, secondaryAxisConfig, seriesWithHover);

  const legendSettings: any = (dataView.metadata?.objects as any)?.legend || {};
  const legendShow: boolean = legendSettings["show"] !== false;
  const legendPosition: string = legendSettings["position"] || "top";
  const legendAlignment: string = legendSettings["alignment"] || "center"; // left | center | right
  const legendShape = normalizeLegendShape(legendSettings["iconShape"]);
  const legendMarkerSize: number = typeof legendSettings["markerSize"] === "number" ? legendSettings["markerSize"] : 14;
  const legendFontSize: number = typeof legendSettings["fontSize"] === "number" ? legendSettings["fontSize"] : 12;
  const legendIconConfig = legendIconForShape(legendShape, legendMarkerSize);
  const legendIcon = legendIconConfig.icon;
  const legendItemWidth = legendIconConfig.width;
  const legendItemHeight = legendIconConfig.height;
  
  // Legend padding - support both single value and per-side values
  const paddingAll: number = typeof legendSettings["padding"] === "number" ? legendSettings["padding"] : 0;
  const paddingTop: number = typeof legendSettings["paddingTop"] === "number" ? legendSettings["paddingTop"] : paddingAll;
  const paddingRight: number = typeof legendSettings["paddingRight"] === "number" ? legendSettings["paddingRight"] : paddingAll;
  const paddingBottom: number = typeof legendSettings["paddingBottom"] === "number" ? legendSettings["paddingBottom"] : paddingAll;
  const paddingLeft: number = typeof legendSettings["paddingLeft"] === "number" ? legendSettings["paddingLeft"] : paddingAll;
  const legendPadding: number | number[] = [paddingTop, paddingRight, paddingBottom, paddingLeft];
  
  const legendExtraMargin: number = typeof legendSettings["extraMargin"] === "number" ? legendSettings["extraMargin"] : 0;

  // Selection Style settings (for clicks in drill level)
  const selObj: any = (dataView.metadata?.objects as any)?.selectionStyle || {};
  const selColor: string = ensureSolidColor(selObj?.color?.solid?.color || "#0096FF");
  const selBorderColor: string = ensureSolidColor(selObj?.borderColor?.solid?.color || "#0078D4");
  const selBorderWidth: number = typeof selObj?.borderWidth === "number" ? selObj.borderWidth : 1.5;
  const selOpacityPct: number = typeof selObj?.opacity === "number" ? selObj.opacity : 40;
  const selOpacity: number = Math.max(0, Math.min(1, selOpacityPct / 100));

  const drillHeaderSettings: any = (dataView.metadata?.objects as any)?.drillHeader || {};
  const drillHeaderShow: boolean = drillHeaderSettings["show"] !== false;

  // Compute legend placement (adapt to drill state)
  const layout = computeLegendLayout({
    show: legendShow,
    position: legendPosition,
    alignment: legendAlignment,
    extraMargin: legendExtraMargin
  }, this.isDrilled);
  const isVertical = layout.isVertical;
  const legendTop = layout.top;
  const legendBottom = layout.bottom;
  const legendLeft = layout.left;
  const legendRight = layout.right;
  const gridBottom = layout.gridBottom;

    const option: echarts.EChartsCoreOption = {
      tooltip: { trigger: "axis" },
      title: {
        text: (drillHeaderShow && this.isDrilled && this.drillCategory && this.drillCategory !== "undefined")
          ? `Details for ${this.drillCategory}`
          : "",
        left: "center",
        top: this.isDrilled ? "2%" : "5%",
        show: (drillHeaderShow && this.isDrilled && this.drillCategory && this.drillCategory !== "undefined"),
        textStyle: { fontSize: 16 as any, fontWeight: "bold", color: "#333" }
      },
      legend: {
        show: legendShow,
        type: "plain",
        orient: isVertical ? "vertical" : "horizontal",
        top: legendTop,
        bottom: legendBottom,
        left: legendLeft,
        right: legendRight,
        padding: legendPadding,
        itemWidth: legendItemWidth,
        itemHeight: legendItemHeight,
        textStyle: { fontSize: legendFontSize },
        ...(legendIcon ? { icon: legendIcon } : {}),
        data: legendNames
      },
      grid: { left: "3%", right: dualAxisResult.hasSecondaryAxis ? "8%" : "4%", bottom: gridBottom, containLabel: true },
      yAxis: {
        type: "category",
        data: categories,
        axisLine: { show: showXAxisLine },
        axisTick: { show: false },
        splitLine: { show: showXGridLines },
        axisLabel: {
          show: showXLabels,
          rotate: xRotateLabels,
          fontSize: xLabelSize,
          color: xLabelColor,
          fontFamily: xFontFamily,
          fontStyle: xFontStyle,
          fontWeight: xFontWeight,
          margin: 10
        }
      },
      xAxis: dualAxisResult.yAxis,
      series: seriesWithHover,
    };



    /*const option: echarts.EChartsCoreOption = {
  color: ["#3366CC", "#FF66B2", "#91CC75", "#EE6666"], // azul, rosa, verde, rojo (puedes cambiarlo)
  tooltip: { trigger: "axis" },
  legend: { top: "5%", data: legendNames },
  grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
  yAxis: { type: "category", data: categories },
  xAxis: { type: "value", splitLine: { show: false } },
  series: seriesData
};*/

    // Delegate base rendering (non-drilled) to ChartBuilder for consistency
    // CHANGED: Always use the new option object to support dual Y-axis
    if (false && !this.isDrilled) {
      const baseParams: BaseRenderParams = {
        title: {
          show: (drillHeaderShow && this.isDrilled && this.drillCategory && this.drillCategory !== "undefined"),
          text: (drillHeaderShow && this.isDrilled && this.drillCategory && this.drillCategory !== "undefined") ? `Details for ${this.drillCategory}` : "",
          top: this.isDrilled ? "2%" : "5%"
        },
  categories,
  legendNames,
        series: seriesWithHover as any,
        legend: {
          show: legendShow,
          orient: isVertical ? "vertical" : "horizontal",
          top: legendTop,
          bottom: legendBottom,
          left: legendLeft,
          right: legendRight,
          padding: Array.isArray(legendPadding) ? legendPadding as number[] : [paddingTop, paddingRight, paddingBottom, paddingLeft],
          itemWidth: legendItemWidth,
          itemHeight: legendItemHeight,
          fontSize: legendFontSize,
          ...(legendIcon ? { icon: legendIcon } : {})
        },
        xAxis: { showAxisLine: showXAxisLine, show: showXLabels, labelColor: xLabelColor, labelSize: xLabelSize, rotate: xRotateLabels, fontFamily: xFontFamily, fontStyle: xFontStyle, fontWeight: xFontWeight, showGridLines: showXGridLines },
  yAxis: { show: showYLabels, labelColor: yLabelColor, labelSize: yLabelSize, fontFamily: yFontFamily, fontStyle: yFontStyle, fontWeight: yFontWeight, showGridLines: showYGridLines, ...(typeof yAxisMin === 'number' ? { min: yAxisMin } : {}), ...(typeof yAxisMax === 'number' ? { max: yAxisMax } : {}), splitNumber: ySplitNumber, ...(this as any)._fixedYAxisInterval ? { interval: (this as any)._fixedYAxisInterval } : {}, labelFormatter: axisLabelFormatter },
        gridBottom
      };
      this.chartBuilder.renderBase(baseParams);
    } else {
      this.chartInstance.clear();
      this.chartInstance.setOption(option, true);
      this.chartInstance.resize();
    }
  this.currentCategories = Array.isArray(categories) ? [...categories] : [];

    // Save base state for drill-up if not currently drilled
    if (!this.isDrilled) {
      this.baseCategories = Array.isArray(categories) ? [...categories] : [];
      try {
        this.baseSeriesSnapshot = JSON.parse(JSON.stringify(seriesWithHover));
      } catch {
        this.baseSeriesSnapshot = seriesWithHover.map((s) => ({ ...s }));
      }
      this.baseLegendNames = Array.isArray(legendNames) ? [...legendNames] : [];
    }

    // Bind hover handlers via external interaction module
    bindHoverHandlers(this);

    // Drill rendering extracted to drillHandler.renderDrillView

    // Wire click handlers for animated drilldown using real second-level categories
    this.chartInstance.off("click");
    this.chartInstance.off("dblclick");
    this.chartInstance.on("click", (params: any) => {
      if (params && params.componentType === "series" && !this.isDrilled) {
        const clickedCategoryLabel: string = params.name;
        const clickedIndex: number =
          typeof params.dataIndex === "number"
            ? params.dataIndex
            : (this.currentCategories || []).indexOf(clickedCategoryLabel);
        const baseCats =
          (Array.isArray(this.baseCategories) && this.baseCategories.length > 0)
            ? this.baseCategories
            : this.currentCategories;
        const clickedKey =
          clickedIndex >= 0 && baseCats && clickedIndex < baseCats.length
            ? baseCats[clickedIndex]
            : clickedCategoryLabel;
        
        // Handle Power BI selection - select ALL bars for the clicked category
        const selectionIds = this.categorySelectionIds[String(clickedCategoryLabel)];
        if (selectionIds && selectionIds.length) {
          // Check if Ctrl key is pressed for multi-select
          const isCtrlPressed = (params.event?.event as any)?.ctrlKey || false;
          
          console.log(`Selecting category: ${clickedCategoryLabel} with ${selectionIds.length} IDs`);
          this.selectionManager.select(selectionIds, isCtrlPressed).then(() => {
            // Category selected successfully - this should trigger cross-visual filtering
            console.log("Selection applied, cross-filtering should be active");
            this.ensureSelectionPropagation();
          }).catch((error) => {
            console.error("Selection failed:", error);
          });
        }
        
        // Check if this specific category can drill down
        if (!this.canCategoryDrillDown(clickedCategoryLabel, clickedKey)) {
          // No drill down available for this category, selection is already handled above
          return;
        }
        
  const uiParams = { hoverDuration, hoverEasing, selColor, selBorderColor, selBorderWidth, selOpacity, expandX, expandY, drillHeaderShow };
  renderDrillView(this, clickedCategoryLabel, true, clickedKey, uiParams);
        return;
      } else if (this.isDrilled && params && params.componentType === "series") {
        // Drill level: apply persistent selection band over clicked category
        const name = params.name;
        const cats = this.currentCategories || [];
        const idx = cats.indexOf(name);
        if (idx >= 0) {
          // Handle Power BI selection for drill level (all bars for this subcategory)
          const selectionIds = this.drillSelectionIds[String(name)];
          if (selectionIds && selectionIds.length) {
            // Check if Ctrl key is pressed for multi-select
            const isCtrlPressed = (params.event?.event as any)?.ctrlKey || false;
            
            console.log(`Selecting subcategory: ${name} with ${selectionIds.length} IDs`);
            this.selectionManager.select(selectionIds, isCtrlPressed).then(() => {
              // Subcategory selected successfully - this should trigger cross-visual filtering
              console.log("Drill selection applied, cross-filtering should be active");
              this.ensureSelectionPropagation();
            }).catch((error) => {
              console.error("Drill selection failed:", error);
            });
          }

          // Toggle visual selection if same index clicked
          if (this.selectedIndex === idx) {
            this.selectedIndex = null;
              this.selectionGraphic = [];
              updateDrillGraphics(this);
            return;
          }
          // Guard: only draw selection if in drill level
          if (!this.isDrilled) {
            this.selectedIndex = null;
              this.selectionGraphic = [];
              (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
              updateDrillGraphics(this);
            return;
          }
          this.selectedIndex = idx;
            drawSelectionBand(this, idx);
        }
      }
    });

    if (this.isDrilled && this.drillCategory) {
  const uiParams = { hoverDuration, hoverEasing, selColor, selBorderColor, selBorderWidth, selOpacity, expandX, expandY, drillHeaderShow };
  if (!renderDrillView(this, this.drillCategory, false, this.drillCategoryKey, uiParams)) {
        // If no drill data is available anymore, restore base view
        this.restoreBaseView();
      }
    } else {
      this.hoverGraphic = [];
      if (this.selectedIndex !== null) {
        this.selectedIndex = null;
      }
      this.selectionGraphic = [];
      (this.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
        updateDrillGraphics(this);
    }

    this.chartInstance.on("dblclick", () => {
      if (this.isDrilled) {
        this.restoreBaseView();
      }
    });

    // Handle clicking on empty space to clear selections
    const zr = this.chartInstance.getZr();
    zr.on('click', (params: any) => {
      // Only clear selection if clicking on empty space (not on chart elements)
      if (!params.target) {
        this.selectionManager.clear().then(() => {
          // Clear visual selection indicators as well
          if (this.isDrilled) {
            this.selectedIndex = null;
            this.selectionGraphic = [];
            updateDrillGraphics(this);
              updateDrillGraphics(this);
          }
        });
      }
    });

    // Listen for selection changes from other visuals
    this.selectionManager.registerOnSelectCallback((selectionIds: ISelectionId[]) => {
      // This will be called when selections change from other visuals
      console.log("External selection change detected:", selectionIds);
      
      // Force a re-render using last update options to reflect the cleared highlights
      // This ensures the visual refreshes even if Power BI doesn't automatically call update()
      if (this.lastUpdateOptions) {
        console.log("Forcing visual refresh due to external selection change");
        this.update(this.lastUpdateOptions);
      }
    });
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    // Construir el modelo base con las tarjetas migradas
    const model = this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    
    // Agregar dinámicamente las instancias de dataPoint (colores por serie)
    const categorical = this.dataView?.categorical;
    const valuesCols: any = categorical?.values || [];
    
    // ColorHelper para obtener colores persistidos
    const colorHelper = new ColorHelper((this.host as any).colorPalette, {
      objectName: "dataPoint",
      propertyName: "fill",
    } as any);
    
    const dataPointSlices: any[] = [];
    
    const getSeriesColor = (seriesName: string): string => {
      const objects: any = this.dataView?.metadata?.objects || {};
      const dataPoint: any = objects["dataPoint"] || {};
      
      // Color guardado por el usuario en metadata.objects
      const userColor: string | undefined = dataPoint?.[seriesName]?.solid?.color
        ?? dataPoint?.[seriesName]?.fill?.solid?.color;
      
      // Si no hay color de usuario, obtener del seriesColors o del colorHelper
      return userColor 
        || this.seriesColors[seriesName]
        || (colorHelper.getColorForSeriesValue(objects, seriesName) as any)
        || "#3366CC";
    };
    
    const addColorSlice = (name: string, selector?: powerbi.data.Selector) => {
      const color = getSeriesColor(name);
      const slice: any = {
        uid: `dataPoint_${name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        displayName: name,
        control: {
          type: powerbi.visuals.FormattingComponent.ColorPicker,
          properties: {
            descriptor: {
              objectName: "dataPoint",
              propertyName: "fill",
              selector: selector
            },
            value: { value: color }  // ColorPicker espera { value: color }
          }
        }
      };
      dataPointSlices.push(slice);
    };
    
    // Sin leyenda: una serie por medida
    const measures: any[] = (valuesCols as any[]) || [];
    const seriesMeasures = measures.filter((mv: any) => {
      const roles = mv?.source?.roles;
      if (!roles) return false;
      return roles.series1 || roles.series2 || roles.series3 || roles.series4 || roles.series5;
    });
    
    seriesMeasures.forEach((mv: any, idx: number) => {
      const name = mv?.source?.displayName ?? `Series ${idx + 1}`;
      addColorSlice(name, dataViewWildcard.createDataViewWildcardSelector(
        dataViewWildcard.DataViewWildcardMatchingOption.InstancesAndTotals
      ) as any);
    });
    
    // Crear la tarjeta de Data colors si hay series
    if (dataPointSlices.length > 0) {
      const dataPointCard: powerbi.visuals.FormattingCard = {
        displayName: "Data colors",
        uid: "dataPoint_card",
        groups: [{
          displayName: undefined as any,
          uid: "dataPoint_group",
          slices: dataPointSlices
        }]
      };
      
      // Insertar al principio del array de tarjetas
      model.cards.unshift(dataPointCard);
    }
    
    // Create individual series configuration cards
    const seriesNames: string[] = [];
    const seriesSelectors: any[] = [];
    
    seriesMeasures.forEach((mv: any, idx: number) => {
      const name = mv?.source?.displayName ?? `Series ${idx + 1}`;
      seriesNames.push(name);
      
      // Create a specific selector for this measure using its query name
      const selector = {
        metadata: mv?.source?.queryName
      };
      seriesSelectors.push(selector);
    });
    
    // Create a card for each series
    seriesNames.forEach((seriesName: string, index: number) => {
      const seriesKey = seriesName.replace(/[^a-zA-Z0-9]/g, '_');
      const selector = seriesSelectors[index];
      
      // Read current settings from dataView - check both measure source and metadata objects
      let showSeries: boolean | undefined = undefined;
      let chartType: string | undefined = undefined;
      let displayName: string | undefined = undefined;
      let widthPercent: number | undefined = undefined;
      let valueAxis: string | undefined = undefined;
      let fillColor: string | undefined = undefined;
      let lineColor: string | undefined = undefined;
      let lineType: string | undefined = undefined;
      let lineOpacity: number | undefined = undefined;
      let lineWidth: number | undefined = undefined;
      let symbolSize: number | undefined = undefined;
      let showSymbol: boolean | undefined = undefined;
      let scaleFactor: number | undefined = undefined;
      let scaleFactorMode: string | undefined = undefined;
      let scaleFactorBase: number | undefined = undefined;
      let scaleFactorDrill: number | undefined = undefined;
      
      // Try to read from measure source objects first
      if (categorical?.values && seriesMeasures[index]) {
        const measure = seriesMeasures[index];
        const measureObjects = measure?.source?.objects?.seriesConfig || {};
        
        if (measureObjects?.show !== undefined) showSeries = measureObjects.show;
        if (measureObjects?.chartType) chartType = measureObjects.chartType;
        if (measureObjects?.displayName) displayName = measureObjects.displayName;
        if (typeof measureObjects?.widthPercent === 'number') widthPercent = measureObjects.widthPercent;
        if (measureObjects?.valueAxis) valueAxis = measureObjects.valueAxis;
        
        // Read color settings
        if (measureObjects?.fillColor?.solid?.color) fillColor = measureObjects.fillColor.solid.color;
        if (measureObjects?.lineColor?.solid?.color) lineColor = measureObjects.lineColor.solid.color;
        if (measureObjects?.lineType) lineType = measureObjects.lineType;
        if (typeof measureObjects?.lineOpacity === 'number') lineOpacity = measureObjects.lineOpacity;
        if (typeof measureObjects?.lineWidth === 'number') lineWidth = measureObjects.lineWidth;
        if (typeof measureObjects?.symbolSize === 'number') symbolSize = measureObjects.symbolSize;
        if (measureObjects?.showSymbol !== undefined) showSymbol = measureObjects.showSymbol;
        if (typeof measureObjects?.scaleFactor === 'number') scaleFactor = measureObjects.scaleFactor;
        if (measureObjects?.scaleFactorMode) scaleFactorMode = measureObjects.scaleFactorMode;
        if (typeof measureObjects?.scaleFactorBase === 'number') scaleFactorBase = measureObjects.scaleFactorBase;
        if (typeof measureObjects?.scaleFactorDrill === 'number') scaleFactorDrill = measureObjects.scaleFactorDrill;
      }
      
      // Set defaults if not found
      if (showSeries === undefined) showSeries = true;
      if (!chartType) chartType = 'bar';
      if (!displayName) displayName = seriesName;
      if (widthPercent === undefined) widthPercent = 100;
      if (!valueAxis) valueAxis = 'primary';
      if (!fillColor) fillColor = getSeriesColor(seriesName);
      if (!lineColor) lineColor = fillColor;
      if (!lineType) lineType = 'solid';
      if (lineOpacity === undefined) lineOpacity = 100;
      if (lineWidth === undefined) lineWidth = 2;
      if (symbolSize === undefined) symbolSize = 3;
      if (showSymbol === undefined) showSymbol = false;
      if (scaleFactor === undefined) scaleFactor = 1;
      if (!scaleFactorMode) scaleFactorMode = 'same';
      if (scaleFactorBase === undefined) scaleFactorBase = 1;
      if (scaleFactorDrill === undefined) scaleFactorDrill = 1;
      
      const seriesCard: powerbi.visuals.FormattingCard = {
        displayName: `Series ${index + 1} Configuration`,
        uid: `seriesConfig_${seriesKey}_card`,
        topLevelToggle: {
          uid: `seriesConfig_${seriesKey}_show`,
          suppressDisplayName: true,
          control: {
            type: powerbi.visuals.FormattingComponent.ToggleSwitch,
            properties: {
              descriptor: {
                objectName: "seriesConfig",
                propertyName: "show",
                selector: selector
              },
              value: showSeries
            }
          }
        },
        groups: [{
          displayName: undefined as any,
          uid: `seriesConfig_${seriesKey}_group`,
          slices: [
            {
              uid: `seriesConfig_${seriesKey}_displayName`,
              displayName: "Display Name",
              control: {
                type: powerbi.visuals.FormattingComponent.TextInput,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "displayName",
                    selector: selector
                  },
                  value: displayName,
                  placeholder: seriesName
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_chartType`,
              displayName: "Type",
              control: {
                type: powerbi.visuals.FormattingComponent.Dropdown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "chartType",
                    selector: selector
                  },
                  value: chartType
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_widthPercent`,
              displayName: "Width Percent",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "widthPercent",
                    selector: selector
                  },
                  value: widthPercent
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_valueAxis`,
              displayName: "Value Axis",
              control: {
                type: powerbi.visuals.FormattingComponent.Dropdown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "valueAxis",
                    selector: selector
                  },
                  value: valueAxis
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_fillColor`,
              displayName: "Fill Color",
              control: {
                type: powerbi.visuals.FormattingComponent.ColorPicker,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "fillColor",
                    selector: selector
                  },
                  value: { value: fillColor }
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_lineColor`,
              displayName: "Outline Color",
              control: {
                type: powerbi.visuals.FormattingComponent.ColorPicker,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "lineColor",
                    selector: selector
                  },
                  value: { value: lineColor }
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_lineType`,
              displayName: "Outline Type",
              control: {
                type: powerbi.visuals.FormattingComponent.Dropdown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "lineType",
                    selector: selector
                  },
                  value: lineType
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_lineWidth`,
              displayName: "Outline Width",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "lineWidth",
                    selector: selector
                  },
                  value: lineWidth
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_lineOpacity`,
              displayName: "Outline Color Opacity",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "lineOpacity",
                    selector: selector
                  },
                  value: lineOpacity
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_symbolSize`,
              displayName: "Line Width",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "symbolSize",
                    selector: selector
                  },
                  value: symbolSize
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_showSymbol`,
              displayName: "Show Markers",
              control: {
                type: powerbi.visuals.FormattingComponent.ToggleSwitch,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "showSymbol",
                    selector: selector
                  },
                  value: showSymbol
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_scaleFactorMode`,
              displayName: "Scale Factor Mode",
              control: {
                type: powerbi.visuals.FormattingComponent.Dropdown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "scaleFactorMode",
                    selector: selector
                  },
                  value: scaleFactorMode
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_scaleFactor`,
              displayName: "Scale Factor",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "scaleFactor",
                    selector: selector
                  },
                  value: scaleFactor
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_scaleFactorBase`,
              displayName: "Base Scale Factor",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "scaleFactorBase",
                    selector: selector
                  },
                  value: scaleFactorBase
                }
              }
            },
            {
              uid: `seriesConfig_${seriesKey}_scaleFactorDrill`,
              displayName: "Drill Scale Factor",
              control: {
                type: powerbi.visuals.FormattingComponent.NumUpDown,
                properties: {
                  descriptor: {
                    objectName: "seriesConfig",
                    propertyName: "scaleFactorDrill",
                    selector: selector
                  },
                  value: scaleFactorDrill
                }
              }
            }
          ]
        }]
      };
      
      // Set visibility based on scale factor mode
      const group = seriesCard.groups[0] as powerbi.visuals.FormattingGroup;
      const scaleFactorSlice = group.slices.find((s: any) => s.uid === `seriesConfig_${seriesKey}_scaleFactor`);
      const scaleFactorBaseSlice = group.slices.find((s: any) => s.uid === `seriesConfig_${seriesKey}_scaleFactorBase`);
      const scaleFactorDrillSlice = group.slices.find((s: any) => s.uid === `seriesConfig_${seriesKey}_scaleFactorDrill`);
      
      if (scaleFactorSlice) (scaleFactorSlice as any).visible = scaleFactorMode === 'same';
      if (scaleFactorBaseSlice) (scaleFactorBaseSlice as any).visible = scaleFactorMode === 'individual';
      if (scaleFactorDrillSlice) (scaleFactorDrillSlice as any).visible = scaleFactorMode === 'individual';
      
      model.cards.push(seriesCard);
    });
    
    return model;
  }

  public destroy() {
    this.chartInstance.dispose();
  }

}




