// Drill handler module: encapsulates drilldown logic and callbacks
// Assumes visual object carries chartInstance, parsed data, and state flags.

import { updateDrillGraphics } from "../interaction/hoverHandlers";
import { buildDrillSelectionIds } from "../interaction/selectionManager";
import { computeYAxisScale } from "../axes/yAxisScale";
import { computeLegendLayout } from "../layout/legendLayout";
import { createDualAxisConfig, hasSecondaryAxisSeries } from "../axes/dualAxisManager";
import { formatAxisValue } from "../utils/formatUtils";

export function canDrillDown(visual: any): boolean {
	const dv = visual.dataView;
	const categorical = dv?.categorical;
	const drillLevel = visual.drillLevel || 0;
	const currentCat = categorical?.categories?.[drillLevel]?.values || [];
	const nextCat = categorical?.categories?.[drillLevel + 1]?.values || [];
	
	if (!currentCat || currentCat.length === 0 || !nextCat || nextCat.length === 0) return false;
	if (currentCat.length !== nextCat.length) return false;
	const uniqueNextCat = new Set(nextCat);
	if (uniqueNextCat.size <= 1) return false;
	
	const currentToNextMap = new Map<any, Set<any>>();
	for (let i = 0; i < currentCat.length; i++) {
		const c1 = currentCat[i];
		const c2 = nextCat[i];
		if (!currentToNextMap.has(c1)) currentToNextMap.set(c1, new Set());
		currentToNextMap.get(c1)!.add(c2);
	}
	for (const [, nextSet] of currentToNextMap) {
		if (nextSet.size > 1) return true;
	}
	return false;
}

export function canCategoryDrillDown(visual: any, categoryLabel: any, categoryKey?: any): boolean {
	if (!canDrillDown(visual)) return false;
	const dv = visual.dataView;
	const categorical = dv?.categorical;
	const drillLevel = visual.drillLevel || 0;
	const currentCat = categorical?.categories?.[drillLevel]?.values || [];
	const nextCat = categorical?.categories?.[drillLevel + 1]?.values || [];
	
	const matchesCategory = (value: any) => {
		if (categoryKey !== undefined && categoryKey !== null) {
			if (value === categoryKey) return true;
			const valuePrimitive = (value !== null && value !== undefined && typeof value.valueOf === "function") ? value.valueOf() : value;
			const keyPrimitive = (categoryKey !== null && categoryKey !== undefined && typeof categoryKey.valueOf === "function") ? categoryKey.valueOf() : categoryKey;
			if (valuePrimitive === keyPrimitive) return true;
			if (String(valuePrimitive) === String(keyPrimitive)) return true;
		}
		if (value === categoryLabel) return true;
		if (value !== null && value !== undefined && categoryLabel !== null && categoryLabel !== undefined) return String(value) === String(categoryLabel);
		return false;
	};
	const matchingIndices: number[] = [];
	for (let i = 0; i < currentCat.length; i++) if (matchesCategory(currentCat[i])) matchingIndices.push(i);
	if (matchingIndices.length === 0) return false;
	const subcategories = new Set<any>();
	for (const idx of matchingIndices) subcategories.add(nextCat[idx]);
	return subcategories.size > 1;
}

export function buildDrillForCategory(visual: any, clickedCategoryLabel: any, categoryKey?: any): { categories: any[]; series: any[] } {
	const dv = visual.dataView;
	const categorical = dv?.categorical;
	const drillLevel = visual.drillLevel || 0;
	const currentCat = categorical?.categories?.[drillLevel]?.values || [];
	const nextCat = categorical?.categories?.[drillLevel + 1]?.values || [];
	if (!nextCat || nextCat.length === 0) return { categories: [], series: [] };

	const valuesCols: any = categorical?.values || [];
	const groups = valuesCols?.grouped?.() as any[] | undefined;
	
	// Create a map of measure configs by displayName for reliable lookup
	const configMap = new Map<string, any>();
	for (let i = 0; i < valuesCols.length; i++) {
		const mv = valuesCols[i];
		const name = mv?.source?.displayName;
		if (name) {
			configMap.set(name, mv?.source?.objects?.seriesConfig);
		}
	}
	
	const rowCount = currentCat.length;
	const idxs: number[] = [];
	const matchesCategory = (value: any) => {
		if (categoryKey !== undefined && categoryKey !== null) {
			if (value === categoryKey) return true;
			const valuePrimitive = (value !== null && value !== undefined && typeof value.valueOf === "function") ? value.valueOf() : value;
			const keyPrimitive = (categoryKey !== null && categoryKey !== undefined && typeof categoryKey.valueOf === "function") ? categoryKey.valueOf() : categoryKey;
			if (valuePrimitive === keyPrimitive) return true;
			if (String(valuePrimitive) === String(keyPrimitive)) return true;
		}
		if (value === clickedCategoryLabel) return true;
		if (value !== null && value !== undefined && clickedCategoryLabel !== null && clickedCategoryLabel !== undefined) return String(value) === String(clickedCategoryLabel);
		return false;
	};
	for (let i = 0; i < rowCount; i++) if (matchesCategory(currentCat[i])) idxs.push(i);
	const nextCatOrder: any[] = [];
	const seenNext = new Set<any>();
	for (const i of idxs) {
		const v = nextCat[i];
		if (!seenNext.has(v)) { seenNext.add(v); nextCatOrder.push(v); }
	}
	if (nextCatOrder.length <= 1) return { categories: [], series: [] };

	// Apply category limit if enabled (from formatting settings)
	const dataOptions: any = (dv?.metadata?.objects as any)?.dataOptions || {};
	const limitCategories: boolean = dataOptions["limitCategories"] === true;
	const maxCategories: number = typeof dataOptions["maxCategories"] === "number" ? dataOptions["maxCategories"] : 10;
	let finalNextCatOrder = nextCatOrder;
	if (limitCategories && maxCategories > 0 && nextCatOrder.length > maxCategories) {
		finalNextCatOrder = nextCatOrder.slice(0, maxCategories);
	}

	// INTERNAL SORTING FOR DRILL LEVELS
	// Detect sortInfo from categorical values at current drill level
	let sortInfo: number | undefined = undefined;
	const categoryAggregates = new Map<any, number>();
	
	// Build aggregates for each category in this drill level
	for (const cat of finalNextCatOrder) {
		let sum = 0;
		for (const i of idxs) {
			if (nextCat[i] === cat) {
				// Aggregate first measure value for sorting
				const firstMeasure = valuesCols?.[0];
				if (firstMeasure && Array.isArray(firstMeasure.values)) {
					const val = firstMeasure.values[i];
					sum += (typeof val === 'number' && !isNaN(val)) ? val : 0;
				}
			}
		}
		categoryAggregates.set(cat, sum);
	}
	
	// Detect sort direction from first measure
	const firstMeasure = valuesCols?.[0];
	if (firstMeasure && (firstMeasure as any).source?.sort) {
		sortInfo = (firstMeasure as any).source.sort;
	}
	
	// Apply internal sorting if sort is detected
	// SortDirection: 1 = ascending, 2 = descending
	if (sortInfo === 1 || sortInfo === 2) {
		const isAscending = sortInfo === 1;
		
		// Create array of {category, value, index} for sorting
		const categoryData = finalNextCatOrder.map((cat, index) => ({
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
		
		// Create index mapping for reordering series data later
		const sortOrderMap = new Map<any, number>();
		sortedCategories.forEach((cat, newIndex) => {
			sortOrderMap.set(cat, newIndex);
		});
		
		// Update finalNextCatOrder to sorted order
		finalNextCatOrder = sortedCategories;
		
		// Log sort application
		if (visual.debugLogger) {
			visual.debugLogger.log('Drill Sort Applied', {
				level: drillLevel + 1,
				sortInfo,
				direction: isAscending ? 'ascending' : 'descending',
				categoryCount: finalNextCatOrder.length,
				sampleCategories: finalNextCatOrder.slice(0, 5),
				sampleValues: finalNextCatOrder.slice(0, 5).map(cat => categoryAggregates.get(cat))
			});
		}
	}

	const dl: any = (dv?.metadata?.objects as any)?.dataLabels || {};
	const dlShow: boolean = dl["show"] !== false;
	const dlColor: string = (dl["color"] as any)?.solid?.color || "#444";
	const dlFontFamily: string = (dl["fontFamily"] as string) || "Segoe UI";
	const dlFontSize: number = typeof dl["fontSize"] === "number" ? dl["fontSize"] : 12;
	const dlFontStyleSetting: string = (dl["fontStyle"] as string) || "normal";
	const dlFontWeight: any = dlFontStyleSetting === "bold" ? "bold" : "normal";
	const dlFontStyle: any = dlFontStyleSetting === "italic" ? "italic" : "normal";
	const dlTransparency: number = typeof dl["transparency"] === "number" ? dl["transparency"] : 0;
	const dlOpacity: number = Math.max(0, Math.min(1, 1 - (dlTransparency / 100)));
	const dlShowBlankAs: string = (typeof dl["showBlankAs"] === "string") ? dl["showBlankAs"] : "";
	const dlTreatZeroAsBlank: boolean = dl["treatZeroAsBlank"] === true;
	const dlPositionSetting: string = (dl["position"] as any)?.value || dl["position"] || "auto";
	const dlDistance: number = typeof dl["distance"] === "number" ? dl["distance"] : 5;
	
	// Map label position for horizontal bars
	const mapLabelPosition = (pos: string): any => {
		switch (pos) {
			case "right": return "right";
			case "insideEnd": return "insideRight";
			case "outsideEnd": return "right";
			case "insideCenter": return "inside";
			case "insideBase": return "insideLeft";
			case "auto":
			default: return "right";
		}
	};
	const dlPosition = mapLabelPosition(dlPositionSetting);
	
	// Data Labels value formatting
	// Read dropdown values - they can come as objects {value: "...", displayName: "..."} or strings
	const dlValueType: string = (dl["valueType"] as any)?.value || dl["valueType"] || 'auto';
	const dlDisplayUnits: string = (dl["displayUnits"] as any)?.value || dl["displayUnits"] || 'auto';
	const dlDecimals: string = (dl["decimals"] as any)?.value || dl["decimals"] || 'auto';

	// Build format map by series name
	const seriesFormatMap = new Map<string, string>();
	for (let i = 0; i < valuesCols.length; i++) {
		const col = valuesCols[i];
		const name = col?.source?.displayName;
		const format = col?.source?.format;
		if (name && format) {
			seriesFormatMap.set(name, format);
			console.log('[Drill] Format for series', name, ':', format);
		}
	}
	
	// Log to visual debugger if available
	if (visual.debugLogger) {
		visual.debugLogger.log('Drill Format Settings', {
			dlValueType,
			dlDisplayUnits,
			dlDecimals,
			level: drillLevel + 1,
			formatMap: Array.from(seriesFormatMap.entries()).map(([name, format]) => ({ series: name, format }))
		});
	}

	let labelVisibilityValues: any[] | null = null;
	for (let i = 0; i < valuesCols.length; i++) {
		const col = valuesCols[i];
		if (col?.source?.roles?.labelVisibility) { labelVisibilityValues = col.values as any[]; break; }
	}

	const labelVisibilityMapDrill = new Map<any, number>();
	if (labelVisibilityValues && Array.isArray(labelVisibilityValues)) {
		for (const c2Val of finalNextCatOrder) {
			let sum = 0;
			for (const i of idxs) if (nextCat[i] === c2Val) { const visVal = labelVisibilityValues[i]; sum += (visVal === null || visVal === undefined) ? 0 : Number(visVal); }
			labelVisibilityMapDrill.set(c2Val, sum);
		}
	}

	const toNumber = (x: any) => x === null || x === undefined || x === "" ? 0 : typeof x === "number" ? x : Number(x);

	// Map series names to measure names for format lookup
	const seriesToMeasureMap = new Map<string, string>();

	// Basic label formatter (will be updated after series are built with proper formatting)
	const labelFormatterDrill = (params: any) => {
		if (labelVisibilityMapDrill.size > 0) {
			const catName = params.name;
			const visValue = labelVisibilityMapDrill.get(catName) ?? 0;
			if (visValue <= 0) return "";
		}
		const v = params?.value;
		if (v === null || v === undefined || v === "") return dlShowBlankAs;
		if (dlTreatZeroAsBlank) {
			const numeric = typeof v === "number" ? v : Number(v);
			if (!Number.isNaN(numeric) && numeric === 0) return dlShowBlankAs ?? "";
		}
		return v as any;
	};

	const buildSeries = (name: string, dataArr: number[], defaultColor: string, config: any, measureName?: string) => {
		// Register series to measure mapping for format lookup
		if (measureName) {
			seriesToMeasureMap.set(name, measureName);
		}
		
		const chartType = config?.chartType || "bar";
		const widthPercent = config?.widthPercent;
		const valueAxis = config?.valueAxis;
		const scaleFactor = typeof config?.scaleFactor === 'number' ? config.scaleFactor : 1;
		const scaleFactorMode = config?.scaleFactorMode || "same";
		const scaleFactorBase = typeof config?.scaleFactorBase === 'number' ? config.scaleFactorBase : 1;
		const scaleFactorDrill = typeof config?.scaleFactorDrill === 'number' ? config.scaleFactorDrill : 1;
		
		const fillColor = config?.fillColor?.solid?.color || defaultColor;
		const lineColor = config?.lineColor?.solid?.color || fillColor;
		const lineWidth = config?.lineWidth ?? 2;
		const lineType = config?.lineType || "solid";
		// Use same default as base: opacity as fraction (0-1), default to 1 (100%)
		const lineOpacity = typeof config?.lineOpacity === 'number' ? config.lineOpacity / 100 : 1;
		const symbolSize = typeof config?.symbolSize === 'number' ? config.symbolSize : 3;
		const showSymbol = config?.showSymbol !== undefined ? config.showSymbol : false;
		
		// Apply scale factor based on mode:
		// - "same": use scaleFactor for both base and drill
		// - "individual": use scaleFactorDrill for drill view
		let effectiveScaleFactor = scaleFactor;
		if (scaleFactorMode === 'individual') {
			effectiveScaleFactor = scaleFactorDrill;
		}
		
		let processedData = dataArr;
		if (effectiveScaleFactor !== 1) {
			processedData = dataArr.map((val: any) => {
				if (typeof val === 'number') {
					return val * effectiveScaleFactor;
				} else if (val && typeof val.value === 'number') {
					return { ...val, value: val.value * effectiveScaleFactor };
				}
				return val;
			});
		}
		
		const series: any = {
			name,
			type: chartType,
			data: processedData,
			label: { show: dlShow, position: dlPosition, distance: dlDistance, color: dlColor, fontFamily: dlFontFamily, fontSize: dlFontSize, fontStyle: dlFontStyle, fontWeight: dlFontWeight, formatter: labelFormatterDrill, opacity: dlOpacity },
			itemStyle: { color: fillColor },
		};
		
		// Apply bar width
		if (chartType === "bar" && widthPercent !== undefined && widthPercent !== null) {
			series.barWidth = `${widthPercent}%`;
		}
		
		// Apply line styles for line charts
		if (chartType === "line") {
			series.smooth = 0.4;
			series.lineStyle = {
				color: lineColor,
				width: symbolSize,
				type: lineType === "dashed" ? "dashed" : lineType === "dotted" ? "dotted" : "solid",
				opacity: lineOpacity
			};
			series.itemStyle = { color: lineColor };
			series.showSymbol = showSymbol;
		}
		
		// Apply area styles for area charts
		if (chartType === "area") {
			series.type = "line";
			series.smooth = 0.4;
			series.areaStyle = {};
			series.lineStyle = {
				color: lineColor,
				width: symbolSize,
				type: lineType === "dashed" ? "dashed" : lineType === "dotted" ? "dotted" : "solid",
				opacity: lineOpacity
			};
			series.itemStyle = { color: lineColor };
			series.showSymbol = showSymbol;
		}
		
		// Apply secondary axis
		if (valueAxis === "secondary") {
			series.yAxisIndex = 1;
		}
		
		return series;
	};

	const seriesOut: any[] = [];
	if (Array.isArray(groups) && groups.length > 0) {
		const measureCount = groups[0]?.values?.length || 0;
		for (const group of groups) {
			if (measureCount <= 1) {
				const name = group?.name ?? "Group";
				const col0: any = group?.values?.[0] || {};
				const src = col0?.values || [];
				const high: any[] | undefined = col0?.highlights as any[] | undefined;
				const color = visual.seriesColors?.[name] || "#6688cc";
				
				// Get config from original valuesCols
				const measureName = col0?.source?.displayName;
				const config = configMap.get(measureName);
				
				const sums = finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(src[i]); return s; });
				const sumsHigh = Array.isArray(high) ? finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(high[i]); return s; }) : undefined;
				const useHighlights = Array.isArray(sumsHigh) && (sumsHigh as number[]).some(v => v !== null && v !== undefined && Number(v) !== 0);
				seriesOut.push(buildSeries(name, useHighlights ? (sumsHigh as number[]) : sums, color, config, measureName));
			} else {
				for (const mv of group.values || []) {
					const measureName = mv?.source?.displayName ?? "Series";
					const name = `${group?.name ?? "Group"} · ${measureName}`;
					const src = mv?.values || [];
					const high: any[] | undefined = mv?.highlights as any[] | undefined;
					const color = visual.seriesColors?.[name] || "#6688cc";
					
					// Get config from original valuesCols
					const config = configMap.get(measureName);
					
					const sums = finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(src[i]); return s; });
					const sumsHigh = Array.isArray(high) ? finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(high[i]); return s; }) : undefined;
					const useHighlights = Array.isArray(sumsHigh) && (sumsHigh as number[]).some(v => v !== null && v !== undefined && Number(v) !== 0);
					seriesOut.push(buildSeries(name, useHighlights ? (sumsHigh as number[]) : sums, color, config, measureName));
				}
			}
		}
	} else {
		const measures: any[] = (valuesCols as any[]) || [];
		for (const mv of measures) {
			const name = mv?.source?.displayName ?? "Series";
			const src = mv?.values || [];
			const high: any[] | undefined = mv?.highlights as any[] | undefined;
			const color = visual.seriesColors?.[name] || "#6688cc";
			
			// Get config
			const config = mv?.source?.objects?.seriesConfig;
			
			const sums = finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(src[i]); return s; });
			const sumsHigh = Array.isArray(high) ? finalNextCatOrder.map((c2) => { let s = 0; for (const i of idxs) if (nextCat[i] === c2) s += toNumber(high[i]); return s; }) : undefined;
			const useHighlights = Array.isArray(sumsHigh) && (sumsHigh as number[]).some(v => v !== null && v !== undefined && Number(v) !== 0);
			seriesOut.push(buildSeries(name, useHighlights ? (sumsHigh as number[]) : sums, color, config, name));
		}
	}
	
	// Calculate max value across all drill series for label formatting
	let maxValueForLabels = 0;
	for (const s of seriesOut) {
		if (Array.isArray(s.data)) {
			for (const d of s.data) {
				const num = typeof d === 'number' ? Math.abs(d) : (typeof d?.value === 'number' ? Math.abs(d.value) : 0);
				if (num > maxValueForLabels) maxValueForLabels = num;
			}
		}
	}
	
	// Create enhanced label formatter with value formatting
	const labelFormatterWithFormatting = (params: any) => {
		if (labelVisibilityMapDrill.size > 0) {
			const catName = params.name;
			const visValue = labelVisibilityMapDrill.get(catName) ?? 0;
			if (visValue <= 0) return "";
		}
		const v = params?.value;
		if (v === null || v === undefined || v === "") return dlShowBlankAs;
		if (dlTreatZeroAsBlank) {
			const numeric = typeof v === "number" ? v : Number(v);
			if (!Number.isNaN(numeric) && numeric === 0) return dlShowBlankAs ?? "";
		}
		
		// Format value using formatAxisValue with data label settings
		const numericValue = typeof v === "number" ? v : Number(v);
		if (!Number.isNaN(numericValue)) {
			// Get format for current series - try measure name first, then series name
			const seriesName = params?.seriesName;
			const measureName = seriesToMeasureMap.get(seriesName) || seriesName;
			const sourceFormat = seriesFormatMap.get(measureName);
			
			// Debug log sample calls
			if (visual.debugLogger && Math.random() < 0.05) { // Log 5% of labels
				visual.debugLogger.log('Drill Label Format Call', { 
					series: seriesName,
					measure: measureName,
					sourceFormat: sourceFormat,
					value: numericValue,
					dlValueType: dlValueType,
					dlDisplayUnits: dlDisplayUnits,
					dlDecimals: dlDecimals,
					level: drillLevel + 1
				});
			}
			
			const formatted = formatAxisValue(numericValue, maxValueForLabels, {
				valueType: dlValueType,
				displayUnits: dlDisplayUnits,
				decimals: dlDecimals,
				currencyCode: 'USD',
				sourceFormat: sourceFormat
			});
			
			// Log result
			if (visual.debugLogger && Math.random() < 0.05) {
				visual.debugLogger.log('Drill Label Result', {
					input: numericValue,
					output: formatted,
					sourceFormat: sourceFormat
				});
			}
			
			return formatted;
		}
		
		return v as any;
	};
	
	// Apply enhanced formatter to all series
	for (const s of seriesOut) {
		if (s.label) {
			s.label.formatter = labelFormatterWithFormatting;
		}
	}
	
	// Return assembled drill series and ordered subcategories
	return { categories: finalNextCatOrder, series: seriesOut };
}

export interface DrillViewUIParams {
	hoverDuration: number;
	hoverEasing: string;
	selColor: string;
	selBorderColor: string;
	selBorderWidth: number;
	selOpacity: number;
	expandX: number;
	expandY: number;
	drillHeaderShow: boolean;
	topMargin: number;
}

export function renderDrillView(
	visual: any,
	categoryLabel: string,
	resetSelection: boolean,
	categoryKey: any | undefined,
	ui: DrillViewUIParams
): boolean {
	const built = buildDrillForCategory(visual, categoryLabel, categoryKey);
	if (!built.categories || built.categories.length === 0) return false;

	// Build selection IDs for drill level
	buildDrillSelectionIds(visual, categoryLabel, categoryKey);

	let displayLabel = "";
	if (categoryLabel && categoryLabel !== null && categoryLabel !== undefined) displayLabel = String(categoryLabel);
	else if (categoryKey !== undefined && categoryKey !== null) displayLabel = String(categoryKey);
	else displayLabel = "(No Label)";

	const objects: any = visual.dataView?.metadata?.objects || {};
	const legendSettings: any = objects?.legend || {};
	const legendShow: boolean = legendSettings["show"] !== false;
	const pAll: number = typeof legendSettings["padding"] === "number" ? legendSettings["padding"] : 0;
	const pTop: number = typeof legendSettings["paddingTop"] === "number" ? legendSettings["paddingTop"] : pAll;
	const pRight: number = typeof legendSettings["paddingRight"] === "number" ? legendSettings["paddingRight"] : pAll;
	const pBottom: number = typeof legendSettings["paddingBottom"] === "number" ? legendSettings["paddingBottom"] : pAll;
	const pLeft: number = typeof legendSettings["paddingLeft"] === "number" ? legendSettings["paddingLeft"] : pAll;
		const detailMarkerSize: number = typeof legendSettings["markerSize"] === "number" ? legendSettings["markerSize"] : 14;
		const detailFontSize: number = typeof legendSettings["fontSize"] === "number" ? legendSettings["fontSize"] : 12;
	const layout = computeLegendLayout(legendSettings, /*isDrilled*/ true);
	const isVerticalDetail = layout.isVertical;
	const dTop = layout.top;
	const dBottom = layout.bottom;
	const dLeft = layout.left;
	const dRight = layout.right;
		const dGridBottom = layout.gridBottom;

		const drillSeriesWithHover = (built.series || []).map((s: any) => ({
		...s,
		emphasis: { focus: undefined, scale: false },
		stateAnimation: { duration: ui.hoverDuration, easing: ui.hoverEasing },
	}));
	const drillLegendNames = (built.series || []).map((s: any) => s.name);

	console.log("Drill data:", { 
		categories: built.categories, 
		seriesCount: drillSeriesWithHover.length,
		series: drillSeriesWithHover 
	});

	// Build Y-axis scale using shared helper
		const yAxisObj: any = (visual.dataView?.metadata?.objects as any)?.yAxis || {};
		const tolRaw = typeof yAxisObj?.scaleAdjustmentTolerance === 'number' ? yAxisObj.scaleAdjustmentTolerance : 0;
		const userSplitsRaw = typeof yAxisObj?.yAxisSplits === 'number' ? yAxisObj.yAxisSplits : 0;
		const valueType = typeof yAxisObj?.valueType === 'string' ? yAxisObj.valueType : 'auto';
		const displayUnits = typeof yAxisObj?.displayUnits === 'string' ? yAxisObj.displayUnits : 'auto';
		const decimalsRaw: any = yAxisObj?.valueDecimals;
		const valueDecimals = (typeof decimalsRaw === 'number') ? String(decimalsRaw) : (typeof decimalsRaw === 'string' ? decimalsRaw : 'auto');

		// Get format from first series for axis labels
		const valuesCols: any = visual.dataView?.categorical?.values || [];
		const firstSeriesFormat = (valuesCols.length > 0 && valuesCols[0]?.source?.format) ? valuesCols[0].source.format : undefined;

		const scale = computeYAxisScale(built.series || [], {
			tolerance: Math.max(0, Math.min(1, tolRaw)),
			userSplits: userSplitsRaw,
			valueType,
			displayUnits,
			decimals: valueDecimals,
			currencyCode: 'USD',
			sourceFormat: firstSeriesFormat
		});

		const yAxisMin = scale.min;
		const yAxisMax = scale.max;
		const ySplitNumber = scale.splitNumber;
		if (typeof scale.interval === 'number' && userSplitsRaw > 0) (visual as any)._fixedYAxisInterval = scale.interval;

		// Read X-axis configuration
		const xAxisObj: any = objects?.xAxis || {};
		const showXAxisLine: boolean = xAxisObj["showAxisLine"] !== false;
		const showXLabels: boolean = xAxisObj["showLabels"] !== false;
		const xLabelColor: string = (xAxisObj["labelColor"] as any)?.solid?.color || xAxisObj["labelColor"] || "#666666";
		const xLabelSize: number = typeof xAxisObj["labelSize"] === "number" ? xAxisObj["labelSize"] : 12;
		const xRotateLabels: number = typeof xAxisObj["rotateLabels"] === "number" ? xAxisObj["rotateLabels"] : 0;
		const xFontFamily: string = xAxisObj["fontFamily"] || "Segoe UI, sans-serif";
		const xFontStyleRaw: string = xAxisObj["fontStyle"] || "regular";
		const showXGridLines: boolean = xAxisObj["showGridLines"] === true;
		
		// Parse fontStyle for X-axis
		let xFontStyle = "normal";
		let xFontWeight = "normal";
		if (xFontStyleRaw === "bold") xFontWeight = "bold";
		else if (xFontStyleRaw === "italic") xFontStyle = "italic";
		else if (xFontStyleRaw === "boldItalic") { xFontWeight = "bold"; xFontStyle = "italic"; }
		
		// Read Y-axis configuration
		const showYLabels: boolean = yAxisObj["showLabels"] !== false;
		const yLabelColor: string = (yAxisObj["labelColor"] as any)?.solid?.color || yAxisObj["labelColor"] || "#666666";
		const yLabelSize: number = typeof yAxisObj["labelSize"] === "number" ? yAxisObj["labelSize"] : 12;
		const yFontFamily: string = yAxisObj["fontFamily"] || "Segoe UI, sans-serif";
		const yFontStyleRaw: string = yAxisObj["fontStyle"] || "regular";
		const showYGridLines: boolean = yAxisObj["showGridLines"] !== false;
		
		// Parse fontStyle for Y-axis
		let yFontStyle = "normal";
		let yFontWeight = "normal";
		if (yFontStyleRaw === "bold") yFontWeight = "bold";
		else if (yFontStyleRaw === "italic") yFontStyle = "italic";
		else if (yFontStyleRaw === "boldItalic") { yFontWeight = "bold"; yFontStyle = "italic"; }

		// Check if we need dual axis (secondary axis)
		const needsDualAxis = hasSecondaryAxisSeries(built.series || []);
		let yAxisConfig: any;
		
		if (needsDualAxis) {
			const axisConfig = {
				show: showYLabels,
				labelColor: yLabelColor,
				labelSize: yLabelSize,
				fontFamily: yFontFamily,
				fontStyle: yFontStyle,
				fontWeight: yFontWeight,
				showGridLines: showYGridLines,
				...(typeof yAxisMin === 'number' ? { min: yAxisMin } : {}),
				...(typeof yAxisMax === 'number' ? { max: yAxisMax } : {}),
				splitNumber: ySplitNumber,
				...((visual as any)._fixedYAxisInterval ? { interval: (visual as any)._fixedYAxisInterval } : {}),
				labelFormatter: scale.labelFormatter
			};
			const dualAxisResult = createDualAxisConfig(axisConfig, axisConfig, built.series || []);
			yAxisConfig = dualAxisResult.yAxis;
		} else {
			yAxisConfig = {
				show: showYLabels,
				labelColor: yLabelColor,
				labelSize: yLabelSize,
				fontFamily: yFontFamily,
				fontStyle: yFontStyle,
				fontWeight: yFontWeight,
				showGridLines: showYGridLines,
				...(typeof yAxisMin === 'number' ? { min: yAxisMin } : {}),
				...(typeof yAxisMax === 'number' ? { max: yAxisMax } : {}),
				splitNumber: ySplitNumber,
				...((visual as any)._fixedYAxisInterval ? { interval: (visual as any)._fixedYAxisInterval } : {}),
				labelFormatter: scale.labelFormatter
			};
		}

			const drillParams: any = {
		title: { show: ui.drillHeaderShow, text: ui.drillHeaderShow ? `Details for ${displayLabel}` : "", top: "2%" },
		categories: built.categories,
		legendNames: drillLegendNames,
		series: drillSeriesWithHover as any,
		legend: {
			show: legendShow,
			orient: isVerticalDetail ? "vertical" : "horizontal",
			top: dTop,
			bottom: dBottom,
			left: dLeft,
			right: dRight,
			padding: [pTop, pRight, pBottom, pLeft],
				itemWidth: detailMarkerSize,
				itemHeight: detailMarkerSize,
			fontSize: detailFontSize,
				// icon shape handled by legend renderer if present; keep defaults here
		},
		xAxis: { 
			showAxisLine: showXAxisLine, 
			show: showXLabels, 
			labelColor: xLabelColor, 
			labelSize: xLabelSize, 
			rotate: xRotateLabels, 
			fontFamily: xFontFamily, 
			fontStyle: xFontStyle, 
			fontWeight: xFontWeight, 
			showGridLines: showXGridLines 
		},
				yAxis: yAxisConfig,
		gridBottom: dGridBottom,
		topMargin: ui.topMargin,
		animationDuration: 800,
		animationEasing: 'cubicInOut'
	};
	visual.chartBuilder.renderDrill(drillParams);
	visual.isDrilled = true;
	visual.drillLevel = (visual.drillLevel || 0) + 1; // Increment drill level
	visual.drillPath = visual.drillPath || [];
	visual.drillPath.push(categoryKey ?? categoryLabel ?? displayLabel); // Track drill path
	visual.drillCategory = displayLabel;
	visual.drillCategoryKey = categoryKey ?? categoryLabel ?? displayLabel;
	visual.currentCategories = Array.isArray(built.categories) ? [...built.categories] : [];
	visual.hoverGraphic = [];
	if (resetSelection) {
		visual.selectedIndex = null;
		visual.selectionGraphic = [];
	} else if (visual.selectedIndex === null || visual.selectedIndex < 0 || visual.selectedIndex >= visual.currentCategories.length) {
		visual.selectedIndex = null;
		visual.selectionGraphic = [];
	}
	(visual.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
		// Redraw drill-level back/reset overlays; selection band is handled elsewhere
		updateDrillGraphics(visual);
	return true;
}

export function restoreBaseView(visual: any) {
	if (!visual.chartInstance) return;
	visual.selectionManager.clear();
	
	console.log("=== RESTORE BASE VIEW ===");
	console.log("baseCategories:", visual.baseCategories);
	console.log("baseLegendNames:", visual.baseLegendNames);
	console.log("baseSeriesSnapshot:", visual.baseSeriesSnapshot);
	console.log("baseSeriesSnapshot length:", visual.baseSeriesSnapshot?.length);
	
	const objects: any = visual.dataView?.metadata?.objects || {};
	const legendSettings: any = objects?.legend || {};
	const legendShow: boolean = legendSettings["show"] !== false;
	const pos: string = legendSettings["position"] || "top";
	const align: string = legendSettings["alignment"] || "center";
	const extra: number = typeof legendSettings["extraMargin"] === "number" ? legendSettings["extraMargin"] : 0;
	const pAll: number = typeof legendSettings["padding"] === "number" ? legendSettings["padding"] : 0;
	const pTop: number = typeof legendSettings["paddingTop"] === "number" ? legendSettings["paddingTop"] : pAll;
	const pRight: number = typeof legendSettings["paddingRight"] === "number" ? legendSettings["paddingRight"] : pAll;
	const pBottom: number = typeof legendSettings["paddingBottom"] === "number" ? legendSettings["paddingBottom"] : pAll;
	const pLeft: number = typeof legendSettings["paddingLeft"] === "number" ? legendSettings["paddingLeft"] : pAll;
	// reuse legend helpers from visual (they're available via visual module imports)
	const detailShape = visual && visual.normalizeLegendShape ? visual.normalizeLegendShape(legendSettings["iconShape"]) : undefined;
	const detailMarkerSize: number = typeof legendSettings["markerSize"] === "number" ? legendSettings["markerSize"] : 14;
	const detailFontSize: number = typeof legendSettings["fontSize"] === "number" ? legendSettings["fontSize"] : 12;
	const detailIconConfig = visual && visual.legendIconForShape ? visual.legendIconForShape(detailShape, detailMarkerSize) : { width: 14, height: 8 };
	const isVertical = pos === "left" || pos === "right";
	let legendTop: any = undefined, legendBottom: any = undefined, legendLeft: any = undefined, legendRight: any = undefined;
	if (pos === "top") legendTop = `${5 + extra}%`;
	if (pos === "bottom") legendBottom = `${5 + extra}%`;
	if (pos === "left") { legendLeft = "2%"; legendTop = "5%"; }
	if (pos === "right") { legendRight = "2%"; legendTop = "5%"; }
	if (pos === "top" || pos === "bottom") {
		if (align === "left") legendLeft = "2%";
		else if (align === "right") legendRight = "2%";
		else legendLeft = "center";
	}
	const gridBottom = !legendShow ? "3%" : (pos === "bottom" ? `${10 + extra}%` : "3%");
	
	// Read X-axis configuration
	const xAxisObj: any = objects?.xAxis || {};
	const showXAxisLine: boolean = xAxisObj["showAxisLine"] !== false;
	const showXLabels: boolean = xAxisObj["show"] !== false;
	const xLabelColor: string = xAxisObj["labelColor"] || "#666";
	const xLabelSize: number = typeof xAxisObj["labelSize"] === "number" ? xAxisObj["labelSize"] : 12;
	const xRotateLabels: number = typeof xAxisObj["rotate"] === "number" ? xAxisObj["rotate"] : 0;
	const xFontFamily: string = xAxisObj["fontFamily"] || "Segoe UI, sans-serif";
	const xFontStyle: string = xAxisObj["fontStyle"] || "normal";
	const xFontWeight: string = xAxisObj["fontWeight"] || "normal";
	const showXGridLines: boolean = xAxisObj["showGridLines"] === true;
	
	// Read Y-axis configuration
	const yAxisObj: any = objects?.yAxis || {};
	const showYLabels: boolean = yAxisObj["show"] !== false;
	const yLabelColor: string = yAxisObj["labelColor"] || "#666";
	const yLabelSize: number = typeof yAxisObj["labelSize"] === "number" ? yAxisObj["labelSize"] : 12;
	const yFontFamily: string = yAxisObj["fontFamily"] || "Segoe UI, sans-serif";
	const yFontStyle: string = yAxisObj["fontStyle"] || "normal";
	const yFontWeight: string = yAxisObj["fontWeight"] || "normal";
	const showYGridLines: boolean = yAxisObj["showGridLines"] !== false;
	
	// Check if we have secondary axis series
	const hasSecondaryAxis = visual.baseSeriesSnapshot?.some((s: any) => s.yAxisIndex === 1);
	
	console.log("hasSecondaryAxis:", hasSecondaryAxis);
	
	const baseParams: any = {
		title: { show: false, text: '', top: '5%' },
		categories: visual.baseCategories,
		legendNames: visual.baseLegendNames,
		series: visual.baseSeriesSnapshot,
		legend: {
			show: legendShow,
			orient: isVertical ? 'vertical' : 'horizontal',
			top: legendTop,
			bottom: legendBottom,
			left: legendLeft,
			right: legendRight,
			padding: [pTop, pRight, pBottom, pLeft],
			itemWidth: detailIconConfig.width,
			itemHeight: detailIconConfig.height,
			fontSize: detailFontSize,
			...(detailIconConfig.icon ? { icon: detailIconConfig.icon } : {})
		},
		xAxis: { 
			showAxisLine: showXAxisLine, 
			show: showXLabels, 
			labelColor: xLabelColor, 
			labelSize: xLabelSize, 
			rotate: xRotateLabels, 
			fontFamily: xFontFamily, 
			fontStyle: xFontStyle, 
			fontWeight: xFontWeight, 
			showGridLines: showXGridLines 
		},
		yAxis: hasSecondaryAxis ? [
			{ 
				show: showYLabels, 
				labelColor: yLabelColor, 
				labelSize: yLabelSize, 
				fontFamily: yFontFamily, 
				fontStyle: yFontStyle, 
				fontWeight: yFontWeight, 
				showGridLines: showYGridLines 
			},
			{ 
				show: showYLabels, 
				labelColor: yLabelColor, 
				labelSize: yLabelSize, 
				fontFamily: yFontFamily, 
				fontStyle: yFontStyle, 
				fontWeight: yFontWeight, 
				showGridLines: false 
			}
		] : { 
			show: showYLabels, 
			labelColor: yLabelColor, 
			labelSize: yLabelSize, 
			fontFamily: yFontFamily, 
			fontStyle: yFontStyle, 
			fontWeight: yFontWeight, 
			showGridLines: showYGridLines 
		},
		gridBottom
	};
	
	console.log("baseParams to render:", baseParams);
	
	// Reset drill state - go back one level
	visual.drillLevel = Math.max(0, (visual.drillLevel || 0) - 1); // Decrease drill level
	if (visual.drillPath && visual.drillPath.length > 0) {
		visual.drillPath.pop(); // Remove last drilled category
	}
	
	// Only clear drill category if back to base level
	if (visual.drillLevel === 0) {
		visual.drillPath = []; // Clear path when back to base
		visual.drillCategory = null;
		visual.drillCategoryKey = null;
		visual.isDrilled = false;
	} else {
		// Still drilled, keep previous level's category
		visual.isDrilled = true;
		// Restore previous level's category from path if available
		if (visual.drillPath && visual.drillPath.length > 0) {
			const prevCategory = visual.drillPath[visual.drillPath.length - 1];
			visual.drillCategory = prevCategory;
			visual.drillCategoryKey = prevCategory;
		}
	}
	
	visual.hoverGraphic = [];
	visual.selectedIndex = null;
	visual.selectionGraphic = [];
	visual.drillSelectionIds = {};
	
	// Force complete re-render with current options
	if (visual.lastUpdateOptions) {
		visual.update(visual.lastUpdateOptions);
	} else {
		// Fallback to renderBase if lastUpdateOptions not available
		visual.chartBuilder.renderBase(baseParams);
		visual.currentCategories = Array.isArray(visual.baseCategories) ? [...visual.baseCategories] : [];
		(visual.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
		updateDrillGraphics(visual);
	}
}

export function drillBack(visual: any, ui: DrillViewUIParams): void {
	if (!visual.isDrilled || visual.drillLevel <= 1) {
		// At level 1 or base, go back to base view
		restoreBaseView(visual);
		return;
	}
	
	// At level 2 or higher, go back one level
	// First, remove current level from path
	if (visual.drillPath && visual.drillPath.length > 0) {
		visual.drillPath.pop();
	}
	
	// Decrement the level by 2 (because renderDrillView will increment it by 1)
	visual.drillLevel -= 2;
	
	// Get the category for the previous level
	const previousCategory = visual.drillPath && visual.drillPath.length > 0 
		? visual.drillPath[visual.drillPath.length - 1] 
		: null;
	
	if (previousCategory) {
		// Re-render the previous drill level (this will increment drillLevel by 1)
		renderDrillView(visual, previousCategory, true, previousCategory, ui);
	} else {
		// Fallback to base view
		restoreBaseView(visual);
	}
}

export function resetFullView(visual: any) {
	// Reset to base level completely
	visual.drillLevel = 0;
	visual.drillPath = [];
	visual.isDrilled = false;
	visual.drillCategory = null;
	visual.drillCategoryKey = null;
	visual.selectedIndex = null;
	visual.selectionGraphic = [];
	restoreBaseView(visual);
}




