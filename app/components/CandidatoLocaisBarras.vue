<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core'
import type { AgregadoVotos } from '~/data/eleicoes'
import { escaparHtml } from '~/utils/locais'

/**
 * Barras horizontais de votos (uma série, a maior no topo). Serve para bairro,
 * área, zona e região: o que muda é a lista.
 */
const props = withDefaults(defineProps<{
  itens: AgregadoVotos[]
  titulo: string
  /** quantas barras mostrar; o resto fica na tabela */
  limite?: number
  /** mostra o município ao lado do nome (bairros e zonas de vários municípios) */
  comMunicipio?: boolean
}>(), { limite: 15, comMunicipio: false })

// Um tom da rampa azul: forte o bastante sobre o branco e distinto do texto
const COR_BARRA = '#256abf'
const COR_TEXTO = 'rgba(0, 0, 0, 0.87)'
const COR_TEXTO_SUAVE = 'rgba(0, 0, 0, 0.6)'
const COR_GRADE = '#e8e8e8'

// No celular o rótulo divide os ~320px com a barra
function larguraRotulo() {
  return import.meta.client && window.innerWidth < 600 ? 130 : 240
}

const visiveis = computed(() => props.itens.filter(i => i.votos > 0).slice(0, props.limite))

function rotulo(i: AgregadoVotos) {
  const nome = i.nome.length > 28 ? `${i.nome.slice(0, 27)}…` : i.nome
  return props.comMunicipio && i.municipio ? `${nome} · ${i.municipio}` : nome
}

const option = computed<EChartsCoreOption>(() => ({
  animationDuration: 300,
  grid: { left: 8, right: 56, top: 4, bottom: 4, containLabel: true },
  // Toda barra tem o valor na ponta: eixo e grade só fariam ruído (e se
  // sobrepõem no celular)
  xAxis: { type: 'value', show: false },
  yAxis: {
    type: 'category',
    inverse: true,
    data: visiveis.value.map(rotulo),
    axisTick: { show: false },
    axisLine: { lineStyle: { color: COR_GRADE } },
    axisLabel: { color: COR_TEXTO, fontSize: 12, width: larguraRotulo(), overflow: 'truncate' },
  },
  tooltip: {
    trigger: 'item',
    confine: true,
    formatter: (p: { dataIndex: number }) => {
      const i = visiveis.value[p.dataIndex]!
      const onde = i.municipio ? `<br><span style="color:${COR_TEXTO_SUAVE}">${escaparHtml(i.municipio)}</span>` : ''
      return `<b>${escaparHtml(i.nome)}</b>${onde}<br>${i.votos.toLocaleString('pt-BR')} votos · ${i.pctTotal.toFixed(1)}% do total<br>${i.locais} ${i.locais === 1 ? 'local' : 'locais'} de votação`
    },
  },
  series: [{
    type: 'bar',
    data: visiveis.value.map(i => i.votos),
    barMaxWidth: 18,
    itemStyle: { color: COR_BARRA, borderRadius: [0, 4, 4, 0] },
    label: {
      show: true,
      position: 'right',
      color: COR_TEXTO,
      fontSize: 11,
      formatter: (p: { value: number }) => p.value.toLocaleString('pt-BR'),
    },
    emphasis: { itemStyle: { color: '#1c5cab' } },
  }],
}))

const altura = computed(() => `${Math.max(visiveis.value.length * 30 + 32, 80)}px`)
</script>

<template>
  <div>
    <p v-if="visiveis.length === 0" class="text-body-2 text-medium-emphasis text-center py-4 mb-0">
      Sem votos para mostrar.
    </p>
    <ChartsEChart
      v-else
      :option="option"
      :height="altura"
      :descricao="`${titulo}: ${visiveis.map(i => `${i.nome} ${i.votos} votos`).join(', ')}`"
    />
  </div>
</template>
