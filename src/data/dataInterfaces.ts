import * as echarts from 'echarts';
import powerbi from 'powerbi-visuals-api';
import { VisualFormattingSettingsModel } from '../formatting';

export interface ParsedSeries {
  name: string;
  seriesOption: echarts.SeriesOption;
  color: string;
}

export interface ParsedData {
  categories: any[];
  legendNames: string[];
  series: echarts.SeriesOption[];
  seriesColors: { [key: string]: string };
  formatting: VisualFormattingSettingsModel;
  dataView: powerbi.DataView;
  // Flags
  hasData: boolean;
}
