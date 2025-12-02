import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

/**
 * Reusable formatting slices for value formatting (valueType, displayUnits, decimals)
 * Used in Y Axis, Data Labels, and other value display contexts
 */
export class ValueFormatSlices {
  valueType = new formattingSettings.ItemDropdown({
    name: "valueType",
    displayName: "Value type",
    items: [
      { value: "auto", displayName: "Auto" },
      { value: "number", displayName: "Number" },
      { value: "currency", displayName: "Currency" },
      { value: "percent", displayName: "Percent" }
    ],
    value: { value: "auto", displayName: "Auto" }
  });

  displayUnits = new formattingSettings.ItemDropdown({
    name: "displayUnits",
    displayName: "Display Units",
    items: [
      { value: "auto", displayName: "Auto" },
      { value: "none", displayName: "None" },
      { value: "thousands", displayName: "Thousands" },
      { value: "millions", displayName: "Millions" },
      { value: "billions", displayName: "Billions" },
      { value: "trillions", displayName: "Trillions" }
    ],
    value: { value: "auto", displayName: "Auto" }
  });

  decimals = new formattingSettings.ItemDropdown({
    name: "decimals",
    displayName: "Value decimal places",
    items: [
      { value: "auto", displayName: "Auto" },
      { value: "0", displayName: "0" },
      { value: "1", displayName: "1" },
      { value: "2", displayName: "2" },
      { value: "3", displayName: "3" },
      { value: "4", displayName: "4" },
      { value: "5", displayName: "5" },
      { value: "6", displayName: "6" },
      { value: "7", displayName: "7" },
      { value: "8", displayName: "8" },
      { value: "9", displayName: "9" }
    ],
    value: { value: "auto", displayName: "Auto" }
  });

  /**
   * Get all slices as an array for easy inclusion in card slices
   */
  getSlices(): formattingSettings.Slice[] {
    return [this.valueType, this.displayUnits, this.decimals];
  }
}
