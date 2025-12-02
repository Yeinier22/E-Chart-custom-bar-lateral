(function(){
  // Caso sin series: Category + Value
  const categories = ["A", "B", "C", "D", "E", "F"];
  const values = [120, 180, 140, 90, 70, 110];

  const container = document.getElementById("chart");
  const chart = echarts.init(container);

  const option = {
    color: ["#5470C6"],
    tooltip: { trigger: "axis" },
    legend: { top: "5%" },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: [{ name: "Value", type: "bar", data: values, label: { show: true, position: "top" } }]
  };

  chart.setOption(option);
  window.addEventListener("resize", () => chart.resize());
})();
