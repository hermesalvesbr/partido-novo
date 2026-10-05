<script setup lang="ts">
import { formatNumber } from '~/utils/formatters'

// Interface para os dados do candidato vindos da API
interface CandidatoData {
  nm_candidato: string
  nm_urna_candidato: string
  sg_uf: string
  eleicoes: {
    ano_eleicao: number
    ds_cargo: string
    sg_partido: string
    nr_turno: number
    ds_sit_tot_turno: string
    total_votos: number
    municipios_count: number
  }[]
  municipiosRanking: {
    nm_municipio: string
    total_votos: number
    percentual: number
  }[]
  stats: {
    total_votos: number
    anos_ativo: number[]
    partidos: string[]
    cargos: string[]
    vitorias: number
    derrotas: number
  }
}

// Pega o slug da rota
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Sistema de favoritos
const { isFavorito, toggleFavorito } = useFavoritos()
const favorito = computed(() => isFavorito(slug.value))

// Sistema de trending (rastrear acessos)
const { trackAccess } = useTrendingCandidatos()

// Buscar dados do candidato via server API. Lazy só no cliente (não bloqueia a
// navegação); no servidor espera, para responder 404 de verdade a slug inexistente.
const { data: candidatoData, status, error } = await useAsyncData<CandidatoData>(
  `candidato-${slug.value}`,
  () => $fetch('/api/candidato', {
    query: { slug: slug.value },
  }),
  {
    // Cache inteligente: dados eleitorais raramente mudam
    getCachedData(key, nuxtApp, ctx) {
      // Sempre usar cache exceto em refresh manual
      if (ctx.cause === 'refresh:manual')
        return undefined
      // Verificar cache do payload (SSR) ou static
      return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    },
    lazy: import.meta.client,
  },
)

// Slug sem candidato: 404 no SSR, para o buscador não indexar uma página vazia
if (import.meta.server && error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Candidato não encontrado', fatal: true })
}

// Rastrear acesso quando dados do candidato carregarem (fire-and-forget)
watch(candidatoData, (data) => {
  if (data) {
    // Pega a eleição mais recente para exibir nos trending
    const ultimaEleicao = data.eleicoes[0]
    trackAccess({
      slug: slug.value,
      uf: data.sg_uf,
      nome: data.nm_urna_candidato,
      nomeCompleto: data.nm_candidato,
      partido: ultimaEleicao?.sg_partido || '',
      cargo: ultimaEleicao?.ds_cargo || '',
      anoEleicao: ultimaEleicao?.ano_eleicao || 0,
      situacao: ultimaEleicao?.ds_sit_tot_turno || '',
      totalVotos: ultimaEleicao?.total_votos || 0,
    })
  }
}, { immediate: true })

// SEO Meta - título dinâmico baseado nos dados do candidato
useSeoMeta({
  title: () => candidatoData.value?.nm_urna_candidato
    ? `${candidatoData.value.nm_urna_candidato} - ${candidatoData.value.sg_uf}`
    : 'Candidato',
  description: () => candidatoData.value
    ? `Consulte o histórico eleitoral de ${candidatoData.value.nm_urna_candidato} (${candidatoData.value.sg_uf}). ${candidatoData.value.stats.total_votos.toLocaleString('pt-BR')} votos em ${candidatoData.value.stats.anos_ativo.length} eleições. Partidos: ${candidatoData.value.stats.partidos.join(', ')}.`
    : 'Consulte o histórico eleitoral do candidato, votos e resultados de eleições.',
  ogTitle: () => candidatoData.value?.nm_urna_candidato
    ? `${candidatoData.value.nm_urna_candidato} - ${candidatoData.value.sg_uf} | NOVO Pernambuco`
    : 'Candidato | NOVO Pernambuco',
  ogDescription: () => candidatoData.value
    ? `Histórico eleitoral de ${candidatoData.value.nm_urna_candidato}. ${candidatoData.value.stats.total_votos.toLocaleString('pt-BR')} votos em ${candidatoData.value.stats.anos_ativo.length} eleições.`
    : 'Consulte o histórico eleitoral do candidato.',
  twitterTitle: () => candidatoData.value?.nm_urna_candidato
    ? `${candidatoData.value.nm_urna_candidato} - ${candidatoData.value.sg_uf} | NOVO Pernambuco`
    : 'Candidato | NOVO Pernambuco',
  twitterDescription: () => candidatoData.value
    ? `Histórico eleitoral de ${candidatoData.value.nm_urna_candidato}. ${candidatoData.value.stats.total_votos.toLocaleString('pt-BR')} votos.`
    : 'Consulte o histórico eleitoral do candidato.',
  ogType: 'profile',
})

// Dados estruturados: a pessoa e o caminho até ela
useHead(() => {
  const c = candidatoData.value
  if (!c)
    return {}
  const url = `https://novo.softagon.app/candidato/${slug.value}`
  return {
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            '@id': `${url}#pessoa`,
            'name': c.nm_candidato,
            'alternateName': c.nm_urna_candidato,
            'url': url,
            'affiliation': c.eleicoes[0]?.sg_partido ? { '@type': 'PoliticalParty', 'name': c.eleicoes[0].sg_partido } : undefined,
            'homeLocation': { '@type': 'State', 'name': c.sg_uf, 'containedInPlace': { '@type': 'Country', 'name': 'Brasil' } },
          },
          {
            '@type': 'BreadcrumbList',
            'itemListElement': [
              { '@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': 'https://novo.softagon.app/' },
              { '@type': 'ListItem', 'position': 2, 'name': c.nm_urna_candidato },
            ],
          },
        ],
      }),
    }],
  }
})

// Navegação
const router = useRouter()
function goBack() {
  // Navega para home em vez de usar histórico (evita loop com página de análise)
  router.push('/')
}

// Função para favoritar/desfavoritar
function handleToggleFavorito() {
  if (!candidatoData.value)
    return

  toggleFavorito({
    slug: slug.value,
    nome: candidatoData.value.nm_urna_candidato,
    nomeCompleto: candidatoData.value.nm_candidato,
    uf: candidatoData.value.sg_uf,
    partido: candidatoData.value.eleicoes[0]?.sg_partido,
    cargo: candidatoData.value.eleicoes[0]?.ds_cargo,
  })
}

// Compartilhar no WhatsApp
function shareWhatsApp() {
  if (!candidatoData.value)
    return

  const { nm_urna_candidato, sg_uf, stats } = candidatoData.value
  const url = `${window.location.origin}/candidato/${slug.value}`

  const text = `📊 *${nm_urna_candidato}* (${sg_uf})

📥 ${stats.total_votos.toLocaleString('pt-BR')} votos totais
🏆 ${stats.vitorias} eleições vencidas
🗳️ ${stats.anos_ativo.length} eleições disputadas

Confira o histórico eleitoral completo:
${url}`

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(whatsappUrl, '_blank')
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- Header -->
    <v-app-bar flat color="surface" elevation="1">
      <v-btn icon="mdi-arrow-left" @click="goBack" />
      <v-app-bar-title>
        {{ candidatoData?.nm_urna_candidato || 'Candidato' }}
      </v-app-bar-title>

      <template #append>
        <v-btn
          icon="mdi-whatsapp"
          color="success"
          variant="text"
          @click="shareWhatsApp"
        />
        <v-btn
          :icon="favorito ? 'mdi-star' : 'mdi-star-outline'"
          :color="favorito ? 'warning' : undefined"
          variant="text"
          @click="handleToggleFavorito"
        />
      </template>
    </v-app-bar>

    <!-- Loading -->
    <div v-if="status === 'pending'" class="flex-grow-1 d-flex align-center justify-center">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <!-- Erro -->
    <div v-else-if="error || !candidatoData" class="flex-grow-1 d-flex flex-column align-center justify-center pa-4">
      <v-icon size="64" color="error" class="mb-4">
        mdi-account-alert
      </v-icon>
      <p class="text-h6 text-center mb-2">
        Candidato não encontrado
      </p>
      <p class="text-body-2 text-medium-emphasis text-center mb-4">
        Não foi possível encontrar informações para este candidato.
      </p>
      <v-btn color="primary" variant="tonal" @click="goBack">
        Voltar
      </v-btn>
    </div>

    <!-- Conteúdo -->
    <div v-else class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Perfil do Candidato -->
      <v-card flat class="rounded-0">
        <v-card-text class="text-center pa-6">
          <h1 class="text-h5 font-weight-bold mb-1">
            {{ candidatoData.nm_urna_candidato }}
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-3">
            {{ candidatoData.nm_candidato }}
          </p>

          <v-chip color="primary" variant="tonal" size="small">
            <v-icon start size="small">
              mdi-map-marker
            </v-icon>
            {{ candidatoData.sg_uf }}
          </v-chip>
        </v-card-text>
      </v-card>

      <!-- Estatísticas Resumidas -->
      <div class="px-4 py-3">
        <p class="text-overline text-medium-emphasis mb-2">
          Resumo Político
        </p>

        <v-row dense>
          <v-col cols="6">
            <v-card variant="tonal" color="primary" rounded="lg">
              <v-card-text class="text-center pa-3">
                <p class="text-h5 font-weight-bold mb-0">
                  {{ formatNumber(candidatoData.stats.total_votos) }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Votos Totais
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="6">
            <v-card variant="tonal" color="success" rounded="lg">
              <v-card-text class="text-center pa-3">
                <p class="text-h5 font-weight-bold mb-0">
                  {{ candidatoData.stats.vitorias }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Eleições Vencidas
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="6">
            <v-card variant="tonal" color="secondary" rounded="lg">
              <v-card-text class="text-center pa-3">
                <p class="text-h5 font-weight-bold mb-0">
                  {{ candidatoData.stats.anos_ativo.length }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Eleições Disputadas
                </p>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="6">
            <v-card variant="tonal" color="warning" rounded="lg">
              <v-card-text class="text-center pa-3">
                <p class="text-h5 font-weight-bold mb-0">
                  {{ candidatoData.stats.partidos.length }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Partidos
                </p>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Partidos -->
      <div class="px-4 pb-3">
        <p class="text-overline text-medium-emphasis mb-2">
          Partidos
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="partido in candidatoData.stats.partidos"
            :key="partido"
            size="small"
            variant="outlined"
          >
            {{ partido }}
          </v-chip>
        </div>
      </div>

      <!-- Cargos Disputados -->
      <div class="px-4 pb-3">
        <p class="text-overline text-medium-emphasis mb-2">
          Cargos Disputados
        </p>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="cargo in candidatoData.stats.cargos"
            :key="cargo"
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ cargo }}
          </v-chip>
        </div>
      </div>

      <!-- Botão Análise Eleitoral -->
      <div class="px-4 pb-3">
        <v-card
          variant="outlined"
          rounded="lg"
          color="primary"
          :to="`/candidato/${slug}/analise`"
          class="cursor-pointer"
        >
          <v-card-text class="d-flex align-center justify-space-between pa-3">
            <div class="d-flex align-center">
              <v-icon color="primary" class="mr-3">
                mdi-chart-timeline-variant
              </v-icon>
              <div>
                <p class="text-body-2 font-weight-medium mb-0">
                  Análise Eleitoral Inteligente
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  Concorrentes, bloco de corte e oportunidades
                </p>
              </div>
            </div>
            <v-icon color="primary">
              mdi-chevron-right
            </v-icon>
          </v-card-text>
        </v-card>
      </div>

      <!-- Distribuição Geográfica (lazy - carrega independente) -->
      <LazyCandidatoGeografia
        :municipios="candidatoData.municipiosRanking"
        :total-votos="candidatoData.stats.total_votos"
      />

      <!-- Histórico de Eleições (novo componente) -->
      <LazyCandidatoHistorico
        :eleicoes="candidatoData.eleicoes"
      />
    </div>
  </div>
</template>
