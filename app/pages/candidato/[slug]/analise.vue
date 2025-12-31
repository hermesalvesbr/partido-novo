<script setup lang="ts">
import { formatNumber } from '~/utils/formatters'

// Tipos da API
interface CandidatoBloco {
  nm_urna_candidato: string
  nm_candidato: string
  sg_partido: string
  sg_uf: string
  slug: string
  total_votos: number
  ds_sit_tot_turno: string
  eleito: boolean
  posicao: number
  sq_candidato: number
}

interface ConcorrenteInterno {
  nm_urna_candidato: string
  sg_partido: string
  sg_uf: string
  slug: string
  total_votos: number
  diferenca_votos: number
  posicao: number
  eleito: boolean
}

interface ConcorrenteExterno {
  nm_urna_candidato: string
  sg_partido: string
  sg_uf: string
  slug: string
  total_votos: number
  diferenca_votos: number
  posicao: number
  tipo: 'pior_eleito' | 'proximo_acima' | 'proximo_abaixo'
  score_oportunidade: number
}

interface PartidoEficiencia {
  sg_partido: string
  candidatos_bloco: number
  total_votos: number
  eleitos: number
  media_votos: number
  eficiencia: number
}

interface AnaliseEleicao {
  ano_eleicao: number
  nm_municipio: string
  sg_uf: string
  ds_cargo: string
  nr_turno: number
  candidato: {
    nm_urna_candidato: string
    sg_partido: string
    total_votos: number
    posicao: number
    eleito: boolean
    no_bloco_corte: boolean
  }
  metricas: {
    total_candidatos: number
    vagas: number
    bloco_corte_tamanho: number
    votos_corte: number
    votos_ultimo_bloco: number
  }
  concorrente_interno: ConcorrenteInterno | null
  concorrente_externo: ConcorrenteExterno | null
  pior_eleito_externo: ConcorrenteExterno | null
  partidos_eficiencia: PartidoEficiencia[]
  bloco_corte: CandidatoBloco[]
}

interface AnaliseResponse {
  analises: AnaliseEleicao[]
  resumo: {
    total_eleicoes: number
    vezes_no_bloco: number
    oportunidades_reais: number
  }
}

// Pegar slug da rota
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Buscar análise
const { data: analiseData, status, error } = await useLazyAsyncData<AnaliseResponse>(
  `analise-${slug.value}`,
  () => $fetch('/api/analise-eleitoral', {
    query: { slug: slug.value },
  }),
  {
    getCachedData(key, nuxtApp, ctx) {
      if (ctx.cause === 'refresh:manual')
        return undefined
      return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    },
  },
)

// Eleição selecionada para exibir detalhes
const eleicaoSelecionada = ref(0)

const analiseAtual = computed(() => {
  if (!analiseData.value?.analises.length)
    return null
  return analiseData.value.analises[eleicaoSelecionada.value]
})

// Tab do bloco de corte
const showBlocoCompleto = ref(false)

// SEO - Dados derivados para meta tags
const nomeFormatado = computed(() => {
  const partes = slug.value.split('-').slice(1)
  return partes.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
})

const ultimaEleicao = computed(() => analiseData.value?.analises[0])

const seoTitle = computed(() => {
  if (ultimaEleicao.value) {
    return `Análise Eleitoral de ${nomeFormatado.value} (${ultimaEleicao.value.candidato.sg_partido}) - ${ultimaEleicao.value.ano_eleicao}`
  }
  return `Análise Eleitoral de ${nomeFormatado.value} | Concorrentes e Oportunidades`
})

const seoDescription = computed(() => {
  if (ultimaEleicao.value) {
    const { candidato, nm_municipio, ds_cargo, ano_eleicao } = ultimaEleicao.value
    const resultado = candidato.eleito ? 'foi eleito' : `ficou em ${candidato.posicao}º lugar`
    return `${nomeFormatado.value} (${candidato.sg_partido}) ${resultado} para ${ds_cargo} em ${nm_municipio} ${ano_eleicao} com ${formatNumber(candidato.total_votos)} votos. Veja concorrentes diretos, bloco de corte e oportunidades eleitorais.`
  }
  return `Análise eleitoral completa de ${nomeFormatado.value}: histórico de eleições, concorrentes internos e externos, eficiência partidária e oportunidades de vitória.`
})

const seoKeywords = computed(() => {
  const base = [nomeFormatado.value, 'análise eleitoral', 'eleições', 'candidato', 'votos', 'concorrentes']
  if (ultimaEleicao.value) {
    base.push(
      ultimaEleicao.value.candidato.sg_partido,
      ultimaEleicao.value.nm_municipio,
      ultimaEleicao.value.sg_uf,
      ultimaEleicao.value.ds_cargo,
      String(ultimaEleicao.value.ano_eleicao),
    )
  }
  return base.join(', ')
})

// Meta tags SEO
useSeoMeta({
  title: seoTitle,
  description: seoDescription,
  keywords: seoKeywords,
  author: 'Hermes Alves - Softagon Sistema',
  robots: 'index, follow',
  // Open Graph
  ogType: 'article',
  ogTitle: seoTitle,
  ogDescription: seoDescription,
  ogSiteName: 'NOVO Pernambuco - Softagon Sistema',
  ogLocale: 'pt_BR',
  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: seoTitle,
  twitterDescription: seoDescription,
})

// Canonical URL e JSON-LD Schema
useHead({
  link: [
    { rel: 'canonical', href: `https://novo.softagon.app/candidato/${slug.value}/analise` },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            'headline': seoTitle.value,
            'description': seoDescription.value,
            'author': { '@type': 'Person', 'name': 'Hermes Alves', 'url': 'https://softagon.com.br' },
            'publisher': { '@type': 'Organization', 'name': 'Softagon Sistema', 'url': 'https://softagon.com.br' },
            'mainEntityOfPage': {
              '@type': 'WebPage',
              '@id': `https://novo.softagon.app/candidato/${slug.value}/analise`,
            },
          },
          {
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': 'https://novo.softagon.app' },
              { '@type': 'ListItem', 'position': 2, 'name': nomeFormatado.value, 'item': `https://novo.softagon.app/candidato/${slug.value}` },
              { '@type': 'ListItem', 'position': 3, 'name': 'Análise Eleitoral' },
            ],
          },
        ],
      }),
    },
  ],
})

// Navegação - volta para a página do candidato
const router = useRouter()
function goBack() {
  router.push(`/candidato/${slug.value}`)
}

// Helpers de cor
function getScoreColor(score: number): string {
  if (score <= 100)
    return 'success'
  if (score <= 300)
    return 'warning'
  if (score <= 500)
    return 'orange'
  return 'error'
}

function getScoreLabel(score: number): string {
  if (score <= 100)
    return 'Muito próximo!'
  if (score <= 300)
    return 'Disputável'
  if (score <= 500)
    return 'Exige esforço'
  return 'Difícil'
}

function getEficienciaColor(eficiencia: number): string {
  if (eficiencia >= 0.8)
    return 'success'
  if (eficiencia >= 0.5)
    return 'warning'
  return 'error'
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- Header -->
    <v-app-bar flat color="surface" elevation="1">
      <v-btn icon="mdi-arrow-left" @click="goBack" />
      <v-app-bar-title class="text-body-1">
        Análise de {{ nomeFormatado }}
      </v-app-bar-title>
    </v-app-bar>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex-grow-1 d-flex align-center justify-center">
      <div class="text-center">
        <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
        <p class="text-body-2 text-medium-emphasis">
          Analisando histórico eleitoral...
        </p>
      </div>
    </div>

    <!-- Erro -->
    <div v-else-if="error || !analiseData" class="flex-grow-1 d-flex flex-column align-center justify-center pa-4">
      <v-icon size="64" color="error" class="mb-4">
        mdi-chart-box-outline
      </v-icon>
      <p class="text-h6 text-center mb-2">
        Análise indisponível
      </p>
      <p class="text-body-2 text-medium-emphasis text-center mb-4">
        Não foi possível gerar a análise eleitoral.
      </p>
      <v-btn color="primary" variant="tonal" @click="goBack">
        Voltar
      </v-btn>
    </div>

    <!-- Conteúdo -->
    <div v-else class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Resumo Geral -->
      <v-card flat class="rounded-0">
        <v-card-text class="pa-4">
          <p class="text-overline text-medium-emphasis mb-3">
            Resumo do Histórico
          </p>
          <v-row dense>
            <v-col cols="4">
              <div class="text-center">
                <p class="text-h5 font-weight-bold text-primary mb-0">
                  {{ analiseData.resumo.total_eleicoes }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Eleições
                </p>
              </div>
            </v-col>
            <v-col cols="4">
              <div class="text-center">
                <p class="text-h5 font-weight-bold text-success mb-0">
                  {{ analiseData.resumo.vezes_no_bloco }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  No Bloco
                </p>
              </div>
            </v-col>
            <v-col cols="4">
              <div class="text-center">
                <p class="text-h5 font-weight-bold text-warning mb-0">
                  {{ analiseData.resumo.oportunidades_reais }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Oportunidades
                </p>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>

      <!-- Seletor de Eleição -->
      <div v-if="analiseData.analises.length > 1" class="px-4 py-3">
        <p class="text-overline text-medium-emphasis mb-2">
          <v-icon size="14" class="mr-1">
            mdi-calendar-filter
          </v-icon>
          Selecionar Eleição
        </p>
        <v-chip-group v-model="eleicaoSelecionada" mandatory>
          <v-chip
            v-for="(analise, index) in analiseData.analises"
            :key="index"
            :value="index"
            :variant="eleicaoSelecionada === index ? 'flat' : 'outlined'"
            :color="eleicaoSelecionada === index ? 'primary' : undefined"
            filter
          >
            <span class="font-weight-bold">{{ analise.ano_eleicao }}</span>
            <span :class="eleicaoSelecionada === index ? 'text-white' : 'text-medium-emphasis'" class="ml-1">· {{ analise.nm_municipio }}</span>
            <v-icon
              v-if="analise.candidato.eleito && eleicaoSelecionada === index"
              end
              size="small"
              color="white"
            >
              mdi-check-circle
            </v-icon>
          </v-chip>
        </v-chip-group>
      </div>

      <!-- Análise da Eleição Selecionada -->
      <template v-if="analiseAtual">
        <!-- Cabeçalho da Eleição -->
        <div class="px-4 pb-2">
          <v-card variant="tonal" color="primary" rounded="lg">
            <v-card-text class="pa-3">
              <div class="d-flex justify-space-between align-center">
                <div>
                  <p class="text-body-1 font-weight-bold mb-0">
                    {{ analiseAtual.nm_municipio }}
                  </p>
                  <p class="text-caption mb-0">
                    {{ analiseAtual.ds_cargo }} · {{ analiseAtual.ano_eleicao }}
                    <span v-if="analiseAtual.nr_turno === 2"> · 2º Turno</span>
                  </p>
                </div>
                <v-chip
                  :color="analiseAtual.candidato.eleito ? 'success' : (analiseAtual.candidato.no_bloco_corte ? 'warning' : 'error')"
                  size="small"
                  variant="flat"
                >
                  {{ analiseAtual.candidato.eleito ? 'ELEITO' : (analiseAtual.candidato.no_bloco_corte ? 'No Bloco' : 'Fora') }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Posição do Candidato -->
        <div class="px-4 pb-3">
          <v-card variant="flat" rounded="lg">
            <v-card-text class="pa-3">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-body-2 font-weight-medium">
                  {{ analiseAtual.candidato.nm_urna_candidato }}
                </span>
                <span class="text-body-2">
                  {{ formatNumber(analiseAtual.candidato.total_votos) }} votos
                </span>
              </div>

              <!-- Barra de posição -->
              <div class="position-relative mb-2">
                <v-progress-linear
                  :model-value="100 - ((analiseAtual.candidato.posicao / analiseAtual.metricas.total_candidatos) * 100)"
                  color="primary"
                  bg-color="grey-lighten-3"
                  height="24"
                  rounded
                >
                  <template #default>
                    <span class="text-caption font-weight-bold">
                      {{ analiseAtual.candidato.posicao }}º de {{ analiseAtual.metricas.total_candidatos }}
                    </span>
                  </template>
                </v-progress-linear>
              </div>

              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>
                  <v-icon size="12" color="success">mdi-check-circle</v-icon>
                  {{ analiseAtual.metricas.vagas }} vagas
                </span>
                <span>
                  <v-icon size="12" color="warning">mdi-target</v-icon>
                  Corte: {{ formatNumber(analiseAtual.metricas.votos_corte) }}
                </span>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Score de Oportunidade (destaque) -->
        <div v-if="analiseAtual.pior_eleito_externo && !analiseAtual.candidato.eleito" class="px-4 pb-3">
          <v-card
            :color="getScoreColor(analiseAtual.pior_eleito_externo.score_oportunidade)"
            variant="tonal"
            rounded="lg"
          >
            <v-card-text class="pa-3">
              <p class="text-overline mb-2">
                🎯 Score de Oportunidade
              </p>
              <div class="d-flex justify-space-between align-center">
                <div>
                  <p class="text-h4 font-weight-bold mb-0">
                    {{ analiseAtual.pior_eleito_externo.score_oportunidade > 0 ? '+' : '' }}{{ formatNumber(analiseAtual.pior_eleito_externo.score_oportunidade) }}
                  </p>
                  <p class="text-caption mb-0">
                    votos para disputar vaga
                  </p>
                </div>
                <v-chip :color="getScoreColor(analiseAtual.pior_eleito_externo.score_oportunidade)" variant="flat" size="small">
                  {{ getScoreLabel(analiseAtual.pior_eleito_externo.score_oportunidade) }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </div>

        <!-- Pior Eleito Externo -->
        <div v-if="analiseAtual.pior_eleito_externo" class="px-4 pb-3">
          <p class="text-overline text-medium-emphasis mb-2">
            <v-icon size="14" class="mr-1">
              mdi-target
            </v-icon>
            Alvo Principal (Pior Eleito Externo)
          </p>
          <v-card
            variant="outlined"
            rounded="lg"
            color="error"
            :to="`/candidato/${analiseAtual.pior_eleito_externo.slug}`"
          >
            <v-card-text class="pa-3">
              <div class="d-flex justify-space-between align-center">
                <div>
                  <p class="text-body-2 font-weight-medium mb-0">
                    {{ analiseAtual.pior_eleito_externo.nm_urna_candidato }}
                    <v-icon size="12" class="ml-1">
                      mdi-open-in-new
                    </v-icon>
                  </p>
                  <p class="text-caption text-medium-emphasis mb-0">
                    {{ analiseAtual.pior_eleito_externo.sg_partido }} · {{ analiseAtual.pior_eleito_externo.posicao }}º lugar
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-body-2 font-weight-bold text-error mb-0">
                    {{ formatNumber(analiseAtual.pior_eleito_externo.total_votos) }}
                  </p>
                  <p class="text-caption text-medium-emphasis mb-0">
                    votos
                  </p>
                </div>
              </div>
              <v-divider class="my-2" />
              <p class="text-caption text-medium-emphasis mb-0">
                💡 Este candidato foi eleito com a <strong>menor votação individual</strong> entre os eleitos de outros partidos.
                É a vaga mais vulnerável a ser disputada.
              </p>
            </v-card-text>
          </v-card>
        </div>

        <!-- Concorrentes Internos e Externos -->
        <div class="px-4 pb-3">
          <p class="text-overline text-medium-emphasis mb-2">
            <v-icon size="14" class="mr-1">
              mdi-account-group
            </v-icon>
            Concorrentes Diretos
          </p>

          <v-row dense>
            <!-- Concorrente Interno -->
            <v-col cols="6">
              <v-card
                variant="outlined"
                rounded="lg"
                height="100%"
                :to="analiseAtual.concorrente_interno ? `/candidato/${analiseAtual.concorrente_interno.slug}` : undefined"
              >
                <v-card-text class="pa-3">
                  <p class="text-caption text-warning font-weight-medium mb-2">
                    INTERNO (mesmo partido)
                  </p>
                  <template v-if="analiseAtual.concorrente_interno">
                    <p class="text-body-2 font-weight-medium text-truncate mb-0">
                      {{ analiseAtual.concorrente_interno.nm_urna_candidato }}
                      <v-icon size="10" class="ml-1">
                        mdi-open-in-new
                      </v-icon>
                    </p>
                    <p class="text-caption text-medium-emphasis mb-1">
                      {{ analiseAtual.concorrente_interno.posicao }}º · {{ formatNumber(analiseAtual.concorrente_interno.total_votos) }} votos
                    </p>
                    <v-chip size="x-small" color="warning" variant="tonal">
                      +{{ formatNumber(analiseAtual.concorrente_interno.diferenca_votos) }}
                    </v-chip>
                  </template>
                  <template v-else>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Nenhum acima no partido
                    </p>
                  </template>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Concorrente Externo -->
            <v-col cols="6">
              <v-card
                variant="outlined"
                rounded="lg"
                height="100%"
                :to="analiseAtual.concorrente_externo ? `/candidato/${analiseAtual.concorrente_externo.slug}` : undefined"
              >
                <v-card-text class="pa-3">
                  <p class="text-caption text-primary font-weight-medium mb-2">
                    EXTERNO (outro partido)
                  </p>
                  <template v-if="analiseAtual.concorrente_externo">
                    <p class="text-body-2 font-weight-medium text-truncate mb-0">
                      {{ analiseAtual.concorrente_externo.nm_urna_candidato }}
                      <v-icon size="10" class="ml-1">
                        mdi-open-in-new
                      </v-icon>
                    </p>
                    <p class="text-caption text-medium-emphasis mb-1">
                      {{ analiseAtual.concorrente_externo.sg_partido }} · {{ formatNumber(analiseAtual.concorrente_externo.total_votos) }}
                    </p>
                    <v-chip size="x-small" color="primary" variant="tonal">
                      +{{ formatNumber(analiseAtual.concorrente_externo.diferenca_votos) }}
                    </v-chip>
                  </template>
                  <template v-else>
                    <p class="text-caption text-medium-emphasis mb-0">
                      Nenhum acima
                    </p>
                  </template>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <!-- Eficiência dos Partidos -->
        <div class="px-4 pb-3">
          <p class="text-overline text-medium-emphasis mb-2">
            <v-icon size="14" class="mr-1">
              mdi-chart-bar
            </v-icon>
            Eficiência dos Partidos no Bloco
          </p>
          <v-card variant="flat" rounded="lg">
            <v-list density="compact" class="py-0">
              <v-list-item
                v-for="partido in analiseAtual.partidos_eficiencia.slice(0, 6)"
                :key="partido.sg_partido"
                class="px-3"
              >
                <template #prepend>
                  <v-chip
                    size="x-small"
                    :color="partido.sg_partido === analiseAtual.candidato.sg_partido ? 'primary' : 'grey'"
                    variant="tonal"
                    class="mr-2"
                    style="min-width: 60px;"
                  >
                    {{ partido.sg_partido }}
                  </v-chip>
                </template>

                <v-list-item-title class="text-caption">
                  {{ partido.eleitos }}/{{ partido.candidatos_bloco }} eleitos
                </v-list-item-title>

                <template #append>
                  <v-chip
                    size="x-small"
                    :color="getEficienciaColor(partido.eficiencia)"
                    variant="flat"
                  >
                    {{ Math.round(partido.eficiencia * 100) }}%
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </div>

        <!-- Bloco de Corte -->
        <div class="px-4 pb-4">
          <div class="d-flex justify-space-between align-center mb-2">
            <v-tooltip location="top" max-width="280">
              <template #activator="{ props }">
                <p v-bind="props" class="text-overline text-medium-emphasis mb-0" style="cursor: help;">
                  <v-icon size="14" class="mr-1">
                    mdi-view-list
                  </v-icon>
                  Bloco de Corte ({{ analiseAtual.metricas.bloco_corte_tamanho }} candidatos)
                  <v-icon size="12" class="ml-1">
                    mdi-help-circle-outline
                  </v-icon>
                </p>
              </template>
              <span>São os candidatos que <strong>realmente disputam</strong> as vagas. Quem está fora desse grupo precisaria de um milagre para ganhar.</span>
            </v-tooltip>
            <v-btn
              size="x-small"
              variant="text"
              color="primary"
              @click="showBlocoCompleto = !showBlocoCompleto"
            >
              {{ showBlocoCompleto ? 'Resumir' : 'Ver todos' }}
            </v-btn>
          </div>

          <v-card variant="flat" rounded="lg" class="overflow-hidden">
            <v-list density="compact" class="py-0">
              <template v-for="(candidato, index) in (showBlocoCompleto ? analiseAtual.bloco_corte : analiseAtual.bloco_corte.slice(0, 8))" :key="candidato.sq_candidato">
                <v-divider v-if="index > 0" />
                <v-list-item
                  :class="{
                    'bg-primary-lighten-5': candidato.nm_urna_candidato === analiseAtual.candidato.nm_urna_candidato,
                    'bg-success-lighten-5': candidato.eleito && candidato.nm_urna_candidato !== analiseAtual.candidato.nm_urna_candidato,
                  }"
                  class="px-3 py-1"
                >
                  <template #prepend>
                    <span
                      class="text-caption font-weight-bold mr-2"
                      :class="candidato.eleito ? 'text-success' : 'text-medium-emphasis'"
                      style="min-width: 24px;"
                    >
                      {{ candidato.posicao }}º
                    </span>
                  </template>

                  <div class="d-flex justify-space-between align-center">
                    <div class="text-truncate" style="max-width: 140px;">
                      <span class="text-body-2">{{ candidato.nm_urna_candidato }}</span>
                      <span class="text-caption text-medium-emphasis ml-1">({{ candidato.sg_partido }})</span>
                    </div>
                    <span class="text-body-2 font-weight-medium">
                      {{ formatNumber(candidato.total_votos) }}
                    </span>
                  </div>

                  <template #append>
                    <v-icon
                      v-if="candidato.eleito"
                      size="16"
                      color="success"
                    >
                      mdi-check-circle
                    </v-icon>
                  </template>
                </v-list-item>

                <!-- Linha de corte -->
                <v-divider
                  v-if="candidato.posicao === analiseAtual.metricas.vagas"
                  thickness="2"
                  color="error"
                />
              </template>
            </v-list>
          </v-card>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bg-primary-lighten-5 {
  background-color: rgba(var(--v-theme-primary), 0.08) !important;
}
.bg-success-lighten-5 {
  background-color: rgba(var(--v-theme-success), 0.08) !important;
}
</style>
