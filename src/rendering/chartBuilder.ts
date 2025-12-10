import * as echarts from 'echarts';

export interface AxisText {
  show: boolean;
  labelColor: string;
  labelSize: number;
  fontFamily: string;
  fontStyle: any;
  fontWeight: any;
}

export interface XAxisConfig extends AxisText { showAxisLine: boolean; rotate: number; showGridLines: boolean; }
export interface YAxisConfig extends AxisText { showGridLines: boolean; min?: number; max?: number; splitNumber?: number; interval?: number; labelFormatter?: (value: number) => string; }

export interface LegendConfig {
  show: boolean;
  orient: 'horizontal' | 'vertical';
  top?: any; bottom?: any; left?: any; right?: any;
  padding: number[];
  itemWidth: number; itemHeight: number; fontSize: number;
  icon?: string;
}

export interface BaseRenderParams {
  title?: { show: boolean; text: string; top: string | number };
  categories: any[];
  legendNames: string[];
  series: echarts.SeriesOption[];
  legend: LegendConfig;
  xAxis: XAxisConfig;
  yAxis: YAxisConfig;
  gridBottom: string;
  topMargin?: number;
  gridRightPadding?: number;
}

export interface DrillRenderParams extends BaseRenderParams {
  animationDuration?: number;
  animationEasing?: string;
}

export class ChartBuilder {
  private chart: echarts.ECharts;

  constructor(private hostEl: HTMLElement) {
    this.chart = echarts.init(hostEl as HTMLDivElement);
  }

  public renderBase(input: BaseRenderParams) {
    const option: echarts.EChartsCoreOption = {
      tooltip: { trigger: 'axis' },
      title: input.title && input.title.show ? {
        text: input.title.text,
        left: 'center',
        top: input.title.top,
        textStyle: { fontSize: 16 as any, fontWeight: 'bold', color: '#333' }
      } : { show: false } as any,
      legend: {
        show: input.legend.show,
        type: 'plain',
        orient: input.legend.orient,
        top: input.legend.top,
        bottom: input.legend.bottom,
        left: input.legend.left,
        right: input.legend.right,
        padding: input.legend.padding,
        itemWidth: input.legend.itemWidth,
        itemHeight: input.legend.itemHeight,
        textStyle: { fontSize: input.legend.fontSize },
        ...(input.legend.icon ? { icon: input.legend.icon } : {}),
        data: input.legendNames
      },
      grid: { left: '3%', right: `${3 + (input.gridRightPadding ?? 10)}%`, top: input.topMargin || 10, bottom: input.gridBottom },
      xAxis: Array.isArray(input.yAxis) ? input.yAxis.map((axis: any) => ({
        type: 'value',
        ...(typeof axis.min === 'number' ? { min: axis.min } : {}),
        ...(typeof axis.max === 'number' ? { max: axis.max } : {}),
        ...(typeof axis.splitNumber === 'number' ? { splitNumber: axis.splitNumber } : {}),
        ...(typeof axis.interval === 'number' ? { interval: axis.interval } : {}),
        axisLabel: {
          show: axis.show,
          fontSize: axis.labelSize,
          color: axis.labelColor,
          fontFamily: axis.fontFamily,
          fontStyle: axis.fontStyle,
          fontWeight: axis.fontWeight,
          ...(axis.labelFormatter ? { formatter: axis.labelFormatter as any } : {}),
          margin: 8
        },
        splitLine: { show: axis.showGridLines }
      })) : {
        type: 'value',
        ...(typeof input.yAxis.min === 'number' ? { min: input.yAxis.min } : {}),
        ...(typeof input.yAxis.max === 'number' ? { max: input.yAxis.max } : {}),
        ...(typeof input.yAxis.splitNumber === 'number' ? { splitNumber: input.yAxis.splitNumber } : {}),
        ...(typeof input.yAxis.interval === 'number' ? { interval: input.yAxis.interval } : {}),
        axisLabel: {
          show: input.yAxis.show,
          fontSize: input.yAxis.labelSize,
          color: input.yAxis.labelColor,
          fontFamily: input.yAxis.fontFamily,
          fontStyle: input.yAxis.fontStyle,
          fontWeight: input.yAxis.fontWeight,
          ...(input.yAxis.labelFormatter ? { formatter: input.yAxis.labelFormatter as any } : {}),
          margin: 8
        },
        splitLine: { show: input.yAxis.showGridLines }
      },
      yAxis: {
        type: 'category',
        data: input.categories,
        axisLine: { show: input.xAxis.showAxisLine },
        axisTick: { show: false },
        splitLine: { show: input.xAxis.showGridLines },
        axisLabel: {
          show: input.xAxis.show,
          rotate: input.xAxis.rotate,
          fontSize: input.xAxis.labelSize,
          color: input.xAxis.labelColor,
          fontFamily: input.xAxis.fontFamily,
          fontStyle: input.xAxis.fontStyle,
          fontWeight: input.xAxis.fontWeight,
          margin: 10
        }
      },
      series: input.series
    };
    this.chart.clear();
    this.chart.setOption(option, true);
    this.chart.resize();
  }

  public renderDrill(input: DrillRenderParams) {
    const option: echarts.EChartsCoreOption = {
      tooltip: { trigger: 'axis' },
      title: input.title && input.title.show ? {
        text: input.title.text,
        left: 'center',
        top: input.title.top,
        textStyle: { fontSize: 16 as any, fontWeight: 'bold', color: '#333' }
      } : { show: false } as any,
      legend: {
        show: input.legend.show,
        type: 'plain',
        orient: input.legend.orient,
        top: input.legend.top,
        bottom: input.legend.bottom,
        left: input.legend.left,
        right: input.legend.right,
        padding: input.legend.padding,
        itemWidth: input.legend.itemWidth,
        itemHeight: input.legend.itemHeight,
        textStyle: { fontSize: input.legend.fontSize },
        ...(input.legend.icon ? { icon: input.legend.icon } : {}),
        data: input.legendNames
      },
      grid: { left: '3%', right: `${3 + (input.gridRightPadding ?? 8)}%`, top: input.topMargin || 10, bottom: input.gridBottom },
      xAxis: Array.isArray(input.yAxis) ? input.yAxis.map((axis: any) => ({
        type: 'value',
        ...(typeof axis.min === 'number' ? { min: axis.min } : {}),
        ...(typeof axis.max === 'number' ? { max: axis.max } : {}),
        ...(typeof axis.splitNumber === 'number' ? { splitNumber: axis.splitNumber } : {}),
        ...(typeof axis.interval === 'number' ? { interval: axis.interval } : {}),
        axisLabel: {
          show: axis.show,
          fontSize: axis.labelSize,
          color: axis.labelColor,
          fontFamily: axis.fontFamily,
          fontStyle: axis.fontStyle,
          fontWeight: axis.fontWeight,
          ...(axis.labelFormatter ? { formatter: axis.labelFormatter as any } : {}),
          margin: 8
        },
        splitLine: { show: axis.showGridLines }
      })) : {
        type: 'value',
        ...(typeof input.yAxis.min === 'number' ? { min: input.yAxis.min } : {}),
        ...(typeof input.yAxis.max === 'number' ? { max: input.yAxis.max } : {}),
        ...(typeof input.yAxis.splitNumber === 'number' ? { splitNumber: input.yAxis.splitNumber } : {}),
        ...(typeof input.yAxis.interval === 'number' ? { interval: input.yAxis.interval } : {}),
        axisLabel: {
          show: input.yAxis.show,
          fontSize: input.yAxis.labelSize,
          color: input.yAxis.labelColor,
          fontFamily: input.yAxis.fontFamily,
          fontStyle: input.yAxis.fontStyle,
          fontWeight: input.yAxis.fontWeight,
          ...(input.yAxis.labelFormatter ? { formatter: input.yAxis.labelFormatter as any } : {}),
          margin: 8
        },
        splitLine: { show: input.yAxis.showGridLines }
      },
      yAxis: {
        type: 'category',
        data: input.categories,
        axisLine: { show: input.xAxis.showAxisLine },
        axisTick: { show: false },
        splitLine: { show: input.xAxis.showGridLines },
        axisLabel: {
          show: input.xAxis.show,
          rotate: input.xAxis.rotate,
          fontSize: input.xAxis.labelSize,
          color: input.xAxis.labelColor,
          fontFamily: input.xAxis.fontFamily,
          fontStyle: input.xAxis.fontStyle,
          fontWeight: input.xAxis.fontWeight,
          margin: 10
        }
      },
      series: input.series,
      animationDurationUpdate: input.animationDuration ?? 800,
  animationEasingUpdate: (input.animationEasing as any) ?? 'cubicInOut'
    };
    this.chart.clear();
    this.chart.setOption(option, true);
    this.chart.resize();
  }

  public getInstance(): echarts.ECharts { return this.chart; }
  public dispose() { this.chart.dispose(); }
}
