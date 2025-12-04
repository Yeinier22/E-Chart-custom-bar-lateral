import { ensureSolidColor } from "../utils/colorUtils";
import { computeBandRect } from "../rendering/overlayRenderer";

export function updateDrillGraphics(visual: any) {
  const buttons: any[] = [
    {
      type: "text",
      id: "btnBack",
      left: 20,
      top: 20,
      z: 1000,
      invisible: !visual.isDrilled,
      style: { text: "↩ Back", font: "bold 14px Segoe UI", fill: "#555" },
      cursor: "pointer",
  onclick: () => {
    if (visual.drillBack) {
      // Create ui params from current visual state - read actual settings from visual
      const dataView = visual.dataView;
      const objects = dataView?.metadata?.objects;
      const drillHeaderSettings = objects?.drillHeader || {};
      const drillHeaderShow = drillHeaderSettings["show"] !== false;
      const topMarginSettings = objects?.dataOptions || {};
      const topMargin = typeof topMarginSettings["topMargin"] === "number" ? topMarginSettings["topMargin"] : 10;
      
      const hoverDuration = 200;
      const hoverEasing = "cubicOut";
      const selColor = "#ffcc00";
      const selBorderColor = "#ff6600";
      const selBorderWidth = 2;
      const selOpacity = 0.3;
      const expandX = 8;
      const expandY = 8;
      const ui = { hoverDuration, hoverEasing, selColor, selBorderColor, selBorderWidth, selOpacity, expandX, expandY, drillHeaderShow, topMargin };
      visual.drillBack(ui);
    } else if (visual.restoreBaseView) {
      visual.restoreBaseView();
    }
  },
    },
    {
      type: "text",
      id: "btnReset",
      left: 100,
      top: 20,
      z: 1000,
      invisible: !visual.isDrilled,
      style: { text: "⟳ Reset", font: "bold 14px Segoe UI", fill: "#555" },
      cursor: "pointer",
  onclick: () => visual.resetFullView && visual.resetFullView(),
    },
  ];
  const combined = [
    ...(visual.isDrilled ? (visual.selectionGraphic || []) : []),
    ...(visual.hoverGraphic || []),
    ...buttons,
  ];
  (visual.chartInstance as any).setOption({ graphic: combined } as any, { replaceMerge: ["graphic"] });
}

export function drawSelectionBand(
  visual: any,
  idx: number
): void {
  if (!visual.isDrilled) {
    visual.selectedIndex = null;
    visual.selectionGraphic = [];
    (visual.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    updateDrillGraphics(visual);
    return;
  }
  const cats = visual.currentCategories || [];
  if (!Array.isArray(cats) || idx < 0 || idx >= cats.length) {
    visual.selectedIndex = null;
    visual.selectionGraphic = [];
    (visual.chartInstance as any).setOption({ graphic: [] }, { replaceMerge: ["graphic"] });
    updateDrillGraphics(visual);
    return;
  }

  const objects: any = visual.dataView?.metadata?.objects || {};
  const selObj: any = objects?.selectionStyle || {};
  const selColor: string = ensureSolidColor(selObj?.color?.solid?.color || "#0096FF");
  const selBorderColor: string = ensureSolidColor(selObj?.borderColor?.solid?.color || "#0078D4");
  const selBorderWidth: number = typeof selObj?.borderWidth === "number" ? selObj.borderWidth : 1.5;
  const selOpacityPct: number = typeof selObj?.opacity === "number" ? selObj.opacity : 40;
  const selOpacity: number = Math.max(0, Math.min(1, selOpacityPct / 100));
  const hoverObj: any = objects?.hoverStyle || {};
  const expandX: number = typeof hoverObj?.expandX === "number" ? hoverObj.expandX : 8;
  const expandY: number = typeof hoverObj?.expandY === "number" ? hoverObj.expandY : 8;

  const ec: any = visual.chartInstance as any;
  const rect = computeBandRect(ec, cats, idx, expandX, expandY);
  if (!rect) { updateDrillGraphics(visual); return; }

  visual.selectionGraphic = [{
    type: 'rect', id: 'selectionBand', z: 6,
    shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: 6 },
    style: { fill: selColor, stroke: selBorderColor, lineWidth: selBorderWidth, fillOpacity: selOpacity, strokeOpacity: selOpacity },
    silent: false, cursor: 'pointer', onclick: () => { visual.selectedIndex = null; visual.selectionGraphic = []; updateDrillGraphics(visual); }
  }];
  updateDrillGraphics(visual);
}

export function bindHoverHandlers(visual: any) {
  const objects: any = visual.dataView?.metadata?.objects || {};
  const hoverObj: any = objects?.hoverStyle || {};
  const hoverColor: string = hoverObj?.color?.solid?.color || "#66aaff";
  const fillOpacityPct: number = typeof hoverObj?.fillOpacity === "number" ? hoverObj.fillOpacity
    : (typeof hoverObj?.opacity === "number" ? hoverObj.opacity : 30);
  const borderOpacityPct: number = typeof hoverObj?.borderOpacity === "number" ? hoverObj.borderOpacity : 50;
  const fillOpacity: number = Math.max(0, Math.min(1, fillOpacityPct / 100));
  const strokeOpacity: number = Math.max(0, Math.min(1, borderOpacityPct / 100));
  const hoverBorderColor: string = hoverObj?.borderColor?.solid?.color || "#00000020";
  const hoverBorderWidth: number = typeof hoverObj?.borderWidth === "number" ? hoverObj.borderWidth : 0;
  const expandX: number = typeof hoverObj?.expandX === "number" ? hoverObj.expandX : 8;
  const expandY: number = typeof hoverObj?.expandY === "number" ? hoverObj.expandY : 8;

  let currentHoverIndex: number | null = null;
  const updateHoverBand = (xIndex: number | null) => {
    if (xIndex === null) {
      visual.hoverGraphic = [];
      updateDrillGraphics(visual);
      return;
    }
    const ec: any = visual.chartInstance as any;
    const cats = visual.currentCategories || [];
    const rect = computeBandRect(ec, cats, xIndex, expandX, expandY);
    if (!rect) { visual.hoverGraphic = []; updateDrillGraphics(visual); return; }
    const solidFill = ensureSolidColor(hoverColor);
    const solidStroke = ensureSolidColor(hoverBorderColor);
    visual.hoverGraphic = [{
      type: 'rect', id: 'hoverBand', z: 5,
      shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: 4 },
      style: { fill: solidFill, stroke: solidStroke, lineWidth: hoverBorderWidth, fillOpacity, strokeOpacity },
      silent: true
    }];
    updateDrillGraphics(visual);
  };

  const zr = visual.chartInstance.getZr();
  zr.off('mousemove');
  zr.on('mousemove', (e: any) => {
    const ec: any = visual.chartInstance as any;
    const inGrid = ec.containPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY]);
    if (!inGrid) { if (currentHoverIndex !== null) { currentHoverIndex = null; updateHoverBand(null); } return; }
    const val = ec.convertFromPixel({ gridIndex: 0 }, [e.offsetX, e.offsetY]);
    if (!Array.isArray(val)) return;
    const xVal = val[0];
    const cats = visual.currentCategories || [];
    let xi: number = -1;
    if (typeof xVal === 'number' && Number.isFinite(xVal)) xi = Math.round(xVal);
    else xi = cats.indexOf(xVal);
    if (xi >= 0 && xi < cats.length) {
      if (xi !== currentHoverIndex) { currentHoverIndex = xi; updateHoverBand(xi); }
    }
  });
  zr.off('mouseleave');
  zr.on('mouseleave', () => { currentHoverIndex = null; updateHoverBand(null); });
}
