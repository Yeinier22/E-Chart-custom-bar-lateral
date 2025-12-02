(function(){
  // Simula datos con estructura de drill (Category1, Category2, Series, Value)
  const rawData = [
    // Región Norte
    { cat1: "Norte", cat2: "Enero", series: "Ventas", value: 120 },
    { cat1: "Norte", cat2: "Enero", series: "Costos", value: 90 },
    { cat1: "Norte", cat2: "Febrero", series: "Ventas", value: 200 },
    { cat1: "Norte", cat2: "Febrero", series: "Costos", value: 160 },
    { cat1: "Norte", cat2: "Marzo", series: "Ventas", value: 150 },
    { cat1: "Norte", cat2: "Marzo", series: "Costos", value: 110 },
    
    // Región Sur
    { cat1: "Sur", cat2: "Enero", series: "Ventas", value: 80 },
    { cat1: "Sur", cat2: "Enero", series: "Costos", value: 60 },
    { cat1: "Sur", cat2: "Febrero", series: "Ventas", value: 70 },
    { cat1: "Sur", cat2: "Febrero", series: "Costos", value: 50 },
    { cat1: "Sur", cat2: "Marzo", series: "Ventas", value: 95 },
    { cat1: "Sur", cat2: "Marzo", series: "Costos", value: 40 },
    
    // Región Este
    { cat1: "Este", cat2: "Enero", series: "Ventas", value: 60 },
    { cat1: "Este", cat2: "Enero", series: "Costos", value: 45 },
    { cat1: "Este", cat2: "Febrero", series: "Ventas", value: 100 },
    { cat1: "Este", cat2: "Febrero", series: "Costos", value: 75 },
    { cat1: "Este", cat2: "Marzo", series: "Ventas", value: 85 },
    { cat1: "Este", cat2: "Marzo", series: "Costos", value: 65 },
  ];

  const container = document.getElementById("chart");
  const chart = echarts.init(container);
  const backBtn = document.getElementById("back-btn");
  const levelInfo = document.getElementById("level-info");

  // Simula el estado del visual como en drillHandler.ts
  let isDrilled = false;
  let drillCategory = null;
  let baseSeriesSnapshot = null;  // Esto es clave: se guarda al inicio
  let baseCategories = null;

  // Función para construir datos del nivel principal (agrupado por cat1)
  function buildMainLevel() {
    console.log("=== CONSTRUYENDO NIVEL PRINCIPAL ===");
    
    const seriesNames = [...new Set(rawData.map(d => d.series))];
    const categories = [...new Set(rawData.map(d => d.cat1))];
    
    console.log("Categorías:", categories);
    console.log("Series:", seriesNames);
    
    const seriesData = seriesNames.map(seriesName => {
      const data = categories.map(cat => {
        const sum = rawData
          .filter(d => d.cat1 === cat && d.series === seriesName)
          .reduce((acc, d) => acc + d.value, 0);
        return sum;
      });
      
      return {
        name: seriesName,
        type: "bar",
        data: data,
        itemStyle: { color: seriesName === "Ventas" ? "#5470c6" : "#91cc75" }
      };
    });
    
    console.log("Series construidas:", seriesData);
    
    return { categories, series: seriesData };
  }

  // Función para construir datos de drill (agrupado por cat2 para un cat1 específico)
  function buildDrillLevel(cat1Value) {
    console.log("=== CONSTRUYENDO NIVEL DRILL PARA:", cat1Value, "===");
    
    const filteredData = rawData.filter(d => d.cat1 === cat1Value);
    console.log("Datos filtrados:", filteredData);
    
    const seriesNames = [...new Set(filteredData.map(d => d.series))];
    const categories = [...new Set(filteredData.map(d => d.cat2))];
    
    console.log("Categorías drill:", categories);
    console.log("Series drill:", seriesNames);
    
    const seriesData = seriesNames.map(seriesName => {
      const data = categories.map(cat => {
        const sum = filteredData
          .filter(d => d.cat2 === cat && d.series === seriesName)
          .reduce((acc, d) => acc + d.value, 0);
        return sum;
      });
      
      return {
        name: seriesName,
        type: "bar",
        data: data,
        itemStyle: { color: seriesName === "Ventas" ? "#5470c6" : "#91cc75" }
      };
    });
    
    console.log("Series drill construidas:", seriesData);
    console.log("Verificación - ¿Tiene datos?", {
      categoriesLength: categories.length,
      seriesLength: seriesData.length,
      primeraSerieData: seriesData[0]?.data
    });
    
    return { categories, series: seriesData };
  }

  // Función para renderizar el gráfico
  function render(level) {
    console.log("\n=== RENDERIZANDO ===");
    console.log("Level data:", level);
    
    const option = {
      tooltip: { trigger: "axis" },
      legend: { top: "5%" },
      grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
      xAxis: { type: "category", data: level.categories },
      yAxis: { type: "value" },
      series: level.series
    };
    
    console.log("ECharts option:", option);
    chart.setOption(option, true); // true = reemplaza todo
  }

  // Evento click para drill-down
  chart.on("click", function(params) {
    console.log("\n>>> CLICK EN BARRA <<<");
    console.log("Params:", params);
    
    if (!isDrilled) {
      // Estamos en nivel principal, hacer drill a cat2
      const cat1Value = params.name;
      console.log("Haciendo drill a:", cat1Value);
      console.log("Estado antes del drill:", { isDrilled, baseSeriesSnapshot });
      
      const drillData = buildDrillLevel(cat1Value);
      
      isDrilled = true;
      drillCategory = cat1Value;
      render(drillData);
      levelInfo.textContent = `Nivel: ${cat1Value}`;
      backBtn.disabled = false;
      
  // Botón de regreso - simula restoreBaseView()
  backBtn.addEventListener("click", function() {
    console.log("\n<<< REGRESANDO (restoreBaseView) <<<");
    console.log("Estado antes del back:", { isDrilled, drillCategory, baseSeriesSnapshot });
    
    if (!isDrilled) {
      console.log("No está en drill, no hay nada que hacer");
      return;
    }
    
    // Esta es la lógica clave de restoreBaseView
    console.log("Restaurando vista base...");
    console.log("baseCategories:", baseCategories);
    console.log("baseSeriesSnapshot:", baseSeriesSnapshot);
    
    if (!baseSeriesSnapshot) {
  // Renderizar nivel inicial
  console.log("\n========== INICIO ==========");
  const mainLevel = buildMainLevel();
  
  // IMPORTANTE: Guardar snapshot base (como hace el visual en update())
  baseCategories = [...mainLevel.categories];
  baseSeriesSnapshot = mainLevel.series.map(s => ({ ...s }));
  
  console.log("Base snapshot guardado:", { baseCategories, baseSeriesSnapshot });
  
  render(mainLevel);

  // Responsivo
  window.addEventListener("resize", () => chart.resize());
    };
    
    console.log("Datos a restaurar:", restoredData);
    
    render(restoredData);
    isDrilled = false;
    drillCategory = null;
    levelInfo.textContent = "Nivel: Principal";
    backBtn.disabled = true;
    
    console.log("Estado después del back:", { isDrilled, drillCategory });
  }); render(previous.data);
      levelInfo.textContent = "Nivel: Principal";
      backBtn.disabled = true;
    }
  });

  // Renderizar nivel inicial
  console.log("\n========== INICIO ==========");
  const mainLevel = buildMainLevel();
  render(mainLevel);

  // Responsivo
  window.addEventListener("resize", () => chart.resize());
})();
