import { BarChart, MapChart, ScatterChart } from 'echarts/charts'
import { GeoComponent, GridComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

/**
 * Registra só os módulos do ECharts usados no site (tree-shaking).
 * Tem de rodar antes de registerMap: sem MapChart/GeoComponent o ECharts
 * nem sabe registrar mapa. Chamar mais de uma vez não tem efeito.
 */
export function registrarECharts() {
  use([BarChart, MapChart, ScatterChart, GeoComponent, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])
}
