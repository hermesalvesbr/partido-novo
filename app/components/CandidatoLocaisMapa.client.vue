<script setup lang="ts">
import type { EChartsCoreOption } from 'echarts/core'
import type { LocalVotacaoVotos, MunicipioLocais } from '~/data/eleicoes'
import { registerMap } from 'echarts/core'
import { registrarECharts } from '~/utils/echarts'
import { escaparHtml, tituloLocal } from '~/utils/locais'

/**
 * Mapa de PE com uma bolha por escola: tamanho = votos do candidato ali,
 * cor = % dos votos válidos do local que foram para ele.
 * A malha (public/geo/pe-municipios.json) é do IBGE, sem Fernando de Noronha.
 */
const props = defineProps<{
  locais: LocalVotacaoVotos[]
  municipio: MunicipioLocais | null
}>()

const emit = defineEmits<{
  municipio: [nome: string]
}>()

// Rampa sequencial azul (um tom, claro -> escuro)
const RAMPA = ['#b7d3f6', '#5598e7', '#256abf', '#0d366b']
const COR_TEXTO_SUAVE = 'rgba(0, 0, 0, 0.6)'

const mapaPronto = ref(false)
const falhou = ref(false)

onMounted(async () => {
  try {
    const geo = await $fetch<Parameters<typeof registerMap>[1]>('/geo/pe-municipios.json')
    registrarECharts()
    registerMap('pe', geo)
    mapaPronto.value = true
  }
  catch {
    falhou.value = true
  }
})

const comCoordenada = computed(() => props.locais.filter(l => l.lat != null && l.lon != null))
const semCoordenada = computed(() => props.locais.length - comCoordenada.value.length)

// A cor satura no percentil 95, senão uma escola com 60% apaga o resto do mapa
const maxPct = computed(() => {
  const pcts = comCoordenada.value.map(l => l.pctLocal).sort((a, b) => a - b)
  const p95 = pcts[Math.floor(pcts.length * 0.95)] ?? 1
  return Math.max(Math.ceil(p95), 1)
})
const maxVotos = computed(() => Math.max(...comCoordenada.value.map(l => l.votos), 1))
// Com milhares de escolas (senador, governador) bolhas grandes viram uma mancha;
// no recorte de um município sobra espaço para bolhas maiores
const raioMaximo = computed(() => {
  const n = comCoordenada.value.length
  if (props.municipio || n <= 150)
    return 26
  return n <= 800 ? 18 : 12
})

// Com município filtrado, enquadra as escolas dele
const enquadramento = computed(() => {
  if (!props.municipio || comCoordenada.value.length === 0)
    return undefined
  const lons = comCoordenada.value.map(l => l.lon!)
  const lats = comCoordenada.value.map(l => l.lat!)
  const folga = 0.06
  return [
    [Math.min(...lons) - folga, Math.max(...lats) + folga],
    [Math.max(...lons) + folga, Math.min(...lats) - folga],
  ]
})

const option = computed<EChartsCoreOption>(() => ({
  animation: false,
  geo: {
    map: 'pe',
    nameProperty: 'codarea',
    roam: true,
    scaleLimit: { min: 1, max: 40 },
    boundingCoords: enquadramento.value,
    itemStyle: { areaColor: '#f4f5f7', borderColor: '#c4c8ce', borderWidth: 0.6 },
    emphasis: { disabled: true },
    select: { disabled: true },
    tooltip: { show: false },
    regions: props.municipio?.cdIbge
      ? [{ name: String(props.municipio.cdIbge), itemStyle: { areaColor: '#e6eefa', borderColor: '#256abf', borderWidth: 1.2 } }]
      : [],
  },
  tooltip: {
    trigger: 'item',
    confine: true,
    formatter: (p: { dataIndex: number }) => {
      const l = comCoordenada.value[p.dataIndex]!
      return `<b>${escaparHtml(tituloLocal(l.local))}</b><br>`
        + `<span style="color:${COR_TEXTO_SUAVE}">${escaparHtml(l.bairro)} · ${escaparHtml(l.municipio)}</span><br>`
        + `${l.votos.toLocaleString('pt-BR')} votos · ${l.pctLocal.toFixed(1)}% dos válidos no local<br>`
        + `<span style="color:${COR_TEXTO_SUAVE}">${l.eleitores.toLocaleString('pt-BR')} eleitores aptos</span>`
    },
  },
  visualMap: {
    type: 'continuous',
    dimension: 3,
    min: 0,
    max: maxPct.value,
    inRange: { color: RAMPA },
    calculable: false,
    orient: 'horizontal',
    left: 8,
    bottom: 4,
    itemWidth: 10,
    itemHeight: 120,
    text: [`${maxPct.value}%+`, '0%'],
    textStyle: { color: COR_TEXTO_SUAVE, fontSize: 11 },
  },
  series: [{
    type: 'scatter',
    coordinateSystem: 'geo',
    // maiores primeiro: as bolhas pequenas ficam por cima e continuam clicáveis
    data: comCoordenada.value.map(l => [l.lon, l.lat, l.votos, l.pctLocal]),
    symbolSize: (v: number[]) => 4 + raioMaximo.value * Math.sqrt(v[2]! / maxVotos.value),
    itemStyle: { borderColor: '#ffffff', borderWidth: comCoordenada.value.length > 800 ? 0.5 : 1, opacity: 0.85 },
    emphasis: { scale: 1.3, itemStyle: { borderColor: '#0d366b', borderWidth: 2 } },
  }],
}))

function aoClicar(params: { componentType?: string, dataIndex?: number }) {
  if (props.municipio || params.componentType !== 'series' || params.dataIndex == null)
    return
  const l = comCoordenada.value[params.dataIndex]
  if (l)
    emit('municipio', l.municipio)
}
</script>

<template>
  <div>
    <div v-if="falhou" class="text-body-2 text-medium-emphasis text-center py-8">
      Não foi possível carregar o mapa.
    </div>
    <v-skeleton-loader v-else-if="!mapaPronto" type="image" height="340" />
    <ChartsEChart
      v-else
      class="mapa-locais"
      :option="option"
      :descricao="`Mapa com ${comCoordenada.length} locais de votação; o maior é ${locais[0] ? tituloLocal(locais[0].local) : ''}`"
      @click="aoClicar"
    />
    <p class="text-caption text-medium-emphasis mt-1 mb-0">
      Bolha maior = mais votos. Cor mais escura = maior fatia dos votos válidos daquela escola (escala na legenda, de 0% a {{ maxPct }}% ou mais).
      <template v-if="!municipio">
        Toque numa bolha para ver só o município.
      </template>
      <template v-if="semCoordenada > 0">
        {{ semCoordenada }} {{ semCoordenada === 1 ? 'local sem coordenada não aparece' : 'locais sem coordenada não aparecem' }} no mapa.
      </template>
    </p>
  </div>
</template>

<style scoped>
.mapa-locais {
  height: 300px;
}
@media (min-width: 600px) {
  .mapa-locais {
    height: 420px;
  }
}
</style>
