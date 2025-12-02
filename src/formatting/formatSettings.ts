"use strict";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { ValueFormatSlices } from "./valueFormatSlices";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
import FormattingSettingsGroup = formattingSettings.Group;
import FormattingSettingsCompositeCard = formattingSettings.CompositeCard;

class HoverStyleCardSettings extends FormattingSettingsCard {
  color = new formattingSettings.ColorPicker({ name: "color", displayName: "Hover color", value: { value: "#cce5ff" } });
  opacity = new formattingSettings.NumUpDown({ name: "opacity", displayName: "Opacity (%)", value: 30 });
  fillOpacity = new formattingSettings.NumUpDown({ name: "fillOpacity", displayName: "Fill Opacity (%)", value: 30 });
  borderOpacity = new formattingSettings.NumUpDown({ name: "borderOpacity", displayName: "Border Opacity (%)", value: 50 });
  duration = new formattingSettings.NumUpDown({ name: "duration", displayName: "Transition duration (ms)", value: 300 });
  easing = new formattingSettings.ItemDropdown({ name: "easing", displayName: "Easing", items: [ { value: "linear", displayName: "Linear" }, { value: "cubicOut", displayName: "cubicOut" }, { value: "elasticOut", displayName: "elasticOut" } ], value: { value: "cubicOut", displayName: "cubicOut" } });
  borderColor = new formattingSettings.ColorPicker({ name: "borderColor", displayName: "Border Color", value: { value: "#00000020" } });
  borderWidth = new formattingSettings.NumUpDown({ name: "borderWidth", displayName: "Border Width (px)", value: 0 });
  expandX = new formattingSettings.NumUpDown({ name: "expandX", displayName: "Horizontal Overshoot (px)", value: 8 });
  expandY = new formattingSettings.NumUpDown({ name: "expandY", displayName: "Vertical Overshoot (px)", value: 8 });
  name: string = "hoverStyle"; displayName: string = "Hover Style";
  slices: Array<FormattingSettingsSlice> = [ this.color, this.opacity, this.fillOpacity, this.borderOpacity, this.duration, this.easing, this.borderColor, this.borderWidth, this.expandX, this.expandY ];
}

class DataLabelsCardSettings extends FormattingSettingsCard {
  show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show Data Labels", value: false });
  series = new formattingSettings.ItemDropdown({ name: "series", displayName: "Series", items: [ { value: "all", displayName: "All" } ], value: { value: "all", displayName: "All" } });
  position = new formattingSettings.ItemDropdown({ name: "position", displayName: "Position", items: [ { value: "auto", displayName: "Auto" }, { value: "insideEnd", displayName: "Inside end" }, { value: "outsideEnd", displayName: "Outside end" }, { value: "insideCenter", displayName: "Inside center" }, { value: "insideBase", displayName: "Inside base" } ], value: { value: "auto", displayName: "Auto" } });
  fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI" });
  fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 12 });
  fontStyle = new formattingSettings.ItemDropdown({ name: "fontStyle", displayName: "Font Style", items: [ { value: "normal", displayName: "Normal" }, { value: "bold", displayName: "Bold" }, { value: "italic", displayName: "Italic" } ], value: { value: "normal", displayName: "Normal" } });
  color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#444444" } });
  transparency = new formattingSettings.NumUpDown({ name: "transparency", displayName: "Transparency", value: 0 });
  
  // Value formatting slices
  valueFormatSlices = new ValueFormatSlices();
  
  showBlankAs = new formattingSettings.TextInput({ name: "showBlankAs", displayName: "Show blank as", value: "", placeholder: "" });
  treatZeroAsBlank = new formattingSettings.ToggleSwitch({ name: "treatZeroAsBlank", displayName: "Treat zero as blank", value: false });
  name: string = "dataLabels"; displayName: string = "Data Labels";
  slices: Array<FormattingSettingsSlice> = [ 
    this.show, 
    this.series, 
    this.position, 
    this.fontFamily, 
    this.fontSize, 
    this.fontStyle, 
    this.color, 
    this.transparency,
    ...this.valueFormatSlices.getSlices(),
    this.showBlankAs, 
    this.treatZeroAsBlank 
  ];
}

class DrillHeaderCardSettings extends FormattingSettingsCard { show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show title", value: true }); name: string = "drillHeader"; displayName: string = "Drill header"; slices: Array<FormattingSettingsSlice> = [this.show]; }

class DataOptionsCardSettings extends FormattingSettingsCard {
  limitCategories = new formattingSettings.ToggleSwitch({ name: "limitCategories", displayName: "Limit categories", value: false });
  maxCategories = new formattingSettings.NumUpDown({ name: "maxCategories", displayName: "Max categories", value: 10 });
  name: string = "dataOptions"; displayName: string = "Data Options";
  slices: Array<FormattingSettingsSlice> = [ this.limitCategories, this.maxCategories ];
}

class XAxisCardSettings extends FormattingSettingsCard {
  showAxisLine = new formattingSettings.ToggleSwitch({ name: "showAxisLine", displayName: "Show Axis Line", value: true });
  showLabels = new formattingSettings.ToggleSwitch({ name: "showLabels", displayName: "Show Labels", value: true });
  showGridLines = new formattingSettings.ToggleSwitch({ name: "showGridLines", displayName: "Show Grid Lines", value: false });
  labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label Color", value: { value: "#666666" } });
  labelSize = new formattingSettings.NumUpDown({ name: "labelSize", displayName: "Label Font Size", value: 12 });
  rotateLabels = new formattingSettings.NumUpDown({ name: "rotateLabels", displayName: "Rotate Labels (degrees)", value: 0 });
  fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
  fontStyle = new formattingSettings.ItemDropdown({ name: "fontStyle", displayName: "Font Style", items: [ { value: "regular", displayName: "Regular" }, { value: "bold", displayName: "Bold" }, { value: "italic", displayName: "Italic" }, { value: "boldItalic", displayName: "Bold and italic" } ], value: { value: "regular", displayName: "Regular" } });
  name: string = "xAxis"; displayName: string = "X Axis";
  slices: Array<FormattingSettingsSlice> = [ this.showAxisLine, this.showLabels, this.showGridLines, this.labelColor, this.labelSize, this.rotateLabels, this.fontFamily, this.fontStyle ];
}

class YAxisCardSettings extends FormattingSettingsCard {
  showLabels = new formattingSettings.ToggleSwitch({ name: "showLabels", displayName: "Show Labels", value: true });
  showGridLines = new formattingSettings.ToggleSwitch({ name: "showGridLines", displayName: "Show Grid Lines", value: true });
  labelColor = new formattingSettings.ColorPicker({ name: "labelColor", displayName: "Label Color", value: { value: "#666666" } });
  labelSize = new formattingSettings.NumUpDown({ name: "labelSize", displayName: "Label Font Size", value: 12 });
  fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
  fontStyle = new formattingSettings.ItemDropdown({ name: "fontStyle", displayName: "Font Style", items: [ { value: "regular", displayName: "Regular" }, { value: "bold", displayName: "Bold" }, { value: "italic", displayName: "Italic" }, { value: "boldItalic", displayName: "Bold and italic" } ], value: { value: "regular", displayName: "Regular" } });
  
  // Value formatting slices (reusing component)
  valueFormatSlices = new ValueFormatSlices();
  
  // Note: Y axis uses "valueDecimals" for backward compatibility, but we expose it as "decimals" in the component
  // We'll map it in the code
  valueDecimals = new formattingSettings.ItemDropdown({ name: "valueDecimals", displayName: "Value decimal places", items: [ { value: "auto", displayName: "Auto" }, { value: "0", displayName: "0" }, { value: "1", displayName: "1" }, { value: "2", displayName: "2" }, { value: "3", displayName: "3" }, { value: "4", displayName: "4" }, { value: "5", displayName: "5" }, { value: "6", displayName: "6" }, { value: "7", displayName: "7" }, { value: "8", displayName: "8" }, { value: "9", displayName: "9" } ], value: { value: "auto", displayName: "Auto" } });
  
  scaleAdjustmentTolerance = new formattingSettings.NumUpDown({ name: "scaleAdjustmentTolerance", displayName: "Scale Adjustment Tolerance", value: 0.3 });
  yAxisSplits = new formattingSettings.NumUpDown({ name: "yAxisSplits", displayName: "Y Axis Divisions", value: 0 });
  name: string = "yAxis"; displayName: string = "Y Axis";
  // yAxisSplits: 0 or less means auto (adaptive). >0 fixes the number of divisions
  slices: Array<FormattingSettingsSlice> = [ 
    this.showLabels, 
    this.showGridLines, 
    this.labelColor, 
    this.labelSize, 
    this.fontFamily, 
    this.fontStyle, 
    ...this.valueFormatSlices.getSlices().slice(0, 2), // Only valueType and displayUnits from component
    this.valueDecimals, // Keep original for backward compatibility
    this.scaleAdjustmentTolerance, 
    this.yAxisSplits 
  ];
}

class SelectionStyleCardSettings extends FormattingSettingsCard {
  color = new formattingSettings.ColorPicker({ name: "color", displayName: "Fill color", value: { value: "#0096FF" } });
  borderColor = new formattingSettings.ColorPicker({ name: "borderColor", displayName: "Border color", value: { value: "#0078D4" } });
  borderWidth = new formattingSettings.NumUpDown({ name: "borderWidth", displayName: "Border width", value: 1.5 });
  opacity = new formattingSettings.NumUpDown({ name: "opacity", displayName: "Opacity (%)", value: 40 });
  name: string = "selectionStyle"; displayName: string = "Selection Style";
  slices: Array<FormattingSettingsSlice> = [ this.color, this.borderColor, this.borderWidth, this.opacity ];
}

class LegendGeneralGroup extends FormattingSettingsGroup {
  position = new formattingSettings.ItemDropdown({ name: "position", displayName: "Position", items: [ { value: "top", displayName: "Top" }, { value: "bottom", displayName: "Bottom" }, { value: "left", displayName: "Left" }, { value: "right", displayName: "Right" } ], value: { value: "top", displayName: "Top" } });
  alignment = new formattingSettings.ItemDropdown({ name: "alignment", displayName: "Alignment", items: [ { value: "left", displayName: "Left" }, { value: "center", displayName: "Center" }, { value: "right", displayName: "Right" } ], value: { value: "left", displayName: "Left" } });
  iconShape = new formattingSettings.ItemDropdown({ name: "iconShape", displayName: "Marker Shape", items: [ { value: "default", displayName: "Default" }, { value: "circle", displayName: "Circle" }, { value: "square", displayName: "Square" }, { value: "rhombus", displayName: "Rhombus" }, { value: "triangle", displayName: "Triangle" }, { value: "triangleDown", displayName: "Triangle (upside down)" } ], value: { value: "square", displayName: "Square" } });
  markerSize = new formattingSettings.NumUpDown({ name: "markerSize", displayName: "Marker Size", value: 19 });
  fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 14 });
  extraMargin = new formattingSettings.NumUpDown({ name: "extraMargin", displayName: "Extra Margin (%)", value: 7 });
  name: string = "legendGeneral"; displayName: string = "";
  slices: Array<FormattingSettingsSlice> = [ this.position, this.alignment, this.iconShape, this.markerSize, this.fontSize, this.extraMargin ];
}

class LegendPaddingGroup extends FormattingSettingsGroup {
  padding = new formattingSettings.NumUpDown({ name: "padding", displayName: "Padding (all)", value: 0 });
  paddingTop = new formattingSettings.NumUpDown({ name: "paddingTop", displayName: "Top", value: 0 });
  paddingRight = new formattingSettings.NumUpDown({ name: "paddingRight", displayName: "Right", value: 0 });
  paddingBottom = new formattingSettings.NumUpDown({ name: "paddingBottom", displayName: "Bottom", value: 0 });
  paddingLeft = new formattingSettings.NumUpDown({ name: "paddingLeft", displayName: "Left", value: 0 });
  name: string = "legendPadding"; displayName: string = "Padding"; collapsible: boolean = true;
  slices: Array<FormattingSettingsSlice> = [ this.padding, this.paddingTop, this.paddingRight, this.paddingBottom, this.paddingLeft ];
}

class LegendCardSettings extends FormattingSettingsCompositeCard {
  show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show legend", value: true });
  generalGroup = new LegendGeneralGroup(Object.create(null));
  paddingGroup = new LegendPaddingGroup(Object.create(null));
  name: string = "legend"; displayName: string = "Legend"; topLevelSlice: formattingSettings.ToggleSwitch = this.show;
  groups: Array<FormattingSettingsGroup> = [ this.generalGroup, this.paddingGroup ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
  hoverStyleCard = new HoverStyleCardSettings();
  dataLabelsCard = new DataLabelsCardSettings();
  drillHeaderCard = new DrillHeaderCardSettings();
  dataOptionsCard = new DataOptionsCardSettings();
  xAxisCard = new XAxisCardSettings();
  yAxisCard = new YAxisCardSettings();
  legendCard = new LegendCardSettings();
  selectionStyleCard = new SelectionStyleCardSettings();
  cards = [ this.hoverStyleCard, this.dataLabelsCard, this.drillHeaderCard, this.dataOptionsCard, this.xAxisCard, this.yAxisCard, this.legendCard, this.selectionStyleCard ];
}
