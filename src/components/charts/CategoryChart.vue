<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Chart, DoughnutController, ArcElement, Tooltip, Legend, Title } from 'chart.js'

// Register Chart.js components. The CONTROLLER (DoughnutController) must be
// registered too — registering only ArcElement throws
// "'doughnut' is not a registered controller" on Chart.js v4.
Chart.register(DoughnutController, ArcElement, Tooltip, Legend, Title)

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      labels: [],
      datasets: [],
    }),
  },
  options: {
    type: Object,
    default: () => ({}),
  },
})

const chartCanvas = ref(null)
let chartInstance = null

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
    title: {
      display: true,
      text: 'Credit Purchases by Category',
    },
  },
}

function render() {
  if (!chartCanvas.value) return
  if (chartInstance) chartInstance.destroy()
  chartInstance = new Chart(chartCanvas.value, {
    type: 'doughnut',
    data: props.data,
    options: { ...defaultOptions, ...props.options },
  })
}

onMounted(render)

// The chart mounts before the parent's async load resolves. Without this it is
// never told the data arrived and renders empty forever.
watch(() => [props.data, props.options], render, { deep: true })

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
})
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
