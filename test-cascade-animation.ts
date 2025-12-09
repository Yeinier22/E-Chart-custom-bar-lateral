// 🧪 TEST CASCADE FORZADO - Código de prueba para animación en cascada
// Este código se puede insertar en el método update() para probar la animación

// Sobreescribe datos reales para probar animación
// Esto se ejecuta SIEMPRE, ignora si hay o no datos
this.debugLogger.log('🧪 [TEST CASCADE] Forzando test de 3 barras con animación');
this.chartInstance.clear();
this.chartInstance.setOption({
  xAxis: {
    type: 'category',
    data: ['Barra A', 'Barra B', 'Barra C']
  },
  yAxis: {
    type: 'value'
  },
  series: [{
    type: 'bar',
    data: [10, 50, 90],
    
    // ⭐ CASCADE NATIVO - cada barra aparece con 1 SEGUNDO de diferencia
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    animationDelay: (barIndex) => barIndex * 1000,  // 1000ms = 1 segundo
    animationDurationUpdate: 1200,
    animationDelayUpdate: (barIndex) => barIndex * 1000,  // 1000ms = 1 segundo
    animationEasingUpdate: 'cubicOut'
  }]
});
this.debugLogger.log('🧪 [TEST CASCADE] Test aplicado - CASCADE de 1 segundo entre barras');
return; // STOP - no procesar datos reales
