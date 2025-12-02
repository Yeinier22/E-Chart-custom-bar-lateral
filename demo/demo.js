(function(){
  // Datos de ejemplo similares a los roles del visual: Category, Series, Value
  const categories = ["A", "B", "C", "D", "E"];
  const series = [
    { name: "Serie 1", data: [120, 200, 150, 80, 70] },
    { name: "Serie 2", data: [90, 160, 110, 60, 50] },
    { name: "Serie 3", data: [60, 100, 95, 40, 30] }
  ];

  const container = document.getElementById("chart");
  const chart = echarts.init(container);

  const option = {
    tooltip: { trigger: "axis" },
    legend: { top: "5%" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: series.map(s => ({ name: s.name, type: "bar", data: s.data }))
  };

  chart.setOption(option);

  // Responsivo
  window.addEventListener("resize", () => chart.resize());
})();
