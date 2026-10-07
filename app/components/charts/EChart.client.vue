<script setup lang="ts">
/**
 * Wrapper do vue-echarts. Só roda no cliente (sufixo .client): o ECharts mede o
 * DOM e não tem o que fazer no SSR do Cloudflare.
 * Os módulos registrados estão em utils/echarts.ts.
 */
import type { ECElementEvent, EChartsCoreOption } from 'echarts/core'
import VChart from 'vue-echarts'
import { registrarECharts } from '~/utils/echarts'

defineProps<{
  option: EChartsCoreOption
  /** sem altura aqui, quem usa dá a altura por classe */
  height?: string
  /** texto para leitores de tela; o gráfico em si é canvas */
  descricao: string
}>()

const emit = defineEmits<{
  click: [params: ECElementEvent]
}>()

registrarECharts()
</script>

<template>
  <div role="img" :aria-label="descricao" :style="height ? { height } : undefined">
    <VChart
      :option="option"
      autoresize
      :update-options="{ notMerge: true }"
      @click="emit('click', $event)"
    />
  </div>
</template>
