<script setup lang="ts">
import { formatNumber, formatSituacao, getSituacaoColor } from '~/utils/formatters'
import { parseCandidatoSlug, slugify } from '~/utils/slug'

// Interface para os dados do candidato vindos da API
interface CandidatoRecord {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  nr_turno: number
  ds_sit_tot_turno: string
  qt_votos_nominais: number
  nm_municipio: string
}

// Pega o slug da rota
const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Sistema de favoritos
const { isFavorito, toggleFavorito } = useFavoritos()
const favorito = computed(() => isFavorito(slug.value))

// Parse do slug para extrair UF e nome
const parsedSlug = computed(() => parseCandidatoSlug(slug.value))

// Composable para obter candidato pré-selecionado (passado via navegação)
const { getCandidatoBySlug } = useCandidatoSelecionado()

// Buscar dados do candidato (lazy para não bloquear navegação)
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.postgrestUrl as string

const { data: candidatoData, status, error } = await useLazyAsyncData(
  `candidato-${slug.value}`,
  async () => {
    // Retorna null se o slug for inválido
    if (!parsedSlug.value) {
      return null
    }

    const { uf, nomeSlug } = parsedSlug.value

    // Tenta obter o candidato do estado compartilhado (navegação via CandidatoCard)
    // Isso evita a busca complexa por palavras distintivas
    const candidatoPreSelecionado = getCandidatoBySlug(nomeSlug)

    const { PostgrestClient } = await import('@supabase/postgrest-js')
    const client = new PostgrestClient(apiUrl)

    // OTIMIZAÇÃO: Selecionar APENAS os campos necessários
    const camposNecessarios = [
      'nm_candidato',
      'nm_urna_candidato',
      'sg_partido',
      'ds_cargo',
      'ano_eleicao',
      'nr_turno',
      'ds_sit_tot_turno',
      'qt_votos_nominais',
      'nm_municipio',
    ].join(',')

    // OTIMIZAÇÃO: Se temos o candidato pré-selecionado, usa o nome exato para busca
    // Isso é muito mais eficiente que buscar por palavras distintivas
    let nomeParaBusca: string

    if (candidatoPreSelecionado) {
      // Busca exata pelo nome completo (passado via navegação)
      nomeParaBusca = candidatoPreSelecionado.nm_candidato
    }
    else {
      // Fallback: Estratégia de busca por palavras distintivas (acesso direto via URL)
      const nomeParts = nomeSlug.split('-')
      const palavrasDistintivas = nomeParts
        .filter(p => p.length >= 4)
        .sort((a, b) => b.length - a.length)
        .slice(0, 3)

      const palavrasParaBusca = palavrasDistintivas.length > 0
        ? palavrasDistintivas
        : nomeParts.slice(0, 3)

      nomeParaBusca = palavrasParaBusca[0]?.toUpperCase() || ''
    }

    // Busca por nome completo (exato se pré-selecionado, ou por palavra distintiva)
    const { data, error } = await client
      .from('votacao_candidato_munzona')
      .select(camposNecessarios)
      .eq('sg_uf', uf)
      .ilike('nm_candidato', candidatoPreSelecionado ? nomeParaBusca : `%${nomeParaBusca}%`)
      .order('ano_eleicao', { ascending: false })
      .order('qt_votos_nominais', { ascending: false })
      .limit(candidatoPreSelecionado ? 10000 : 2000)

    if (error) {
      throw error
    }

    // Filtra pelo slug exato do nome completo (slugify remove acentos, garantindo match)
    const rawData = data as unknown as CandidatoRecord[]
    const candidatoRecords = (rawData || []).filter((d) => {
      return slugify(d.nm_candidato) === nomeSlug
    })

    if (candidatoRecords.length === 0) {
      return null
    }

    // Agrupa por ano/cargo para somar votos
    const eleicoesMapa = new Map<string, {
      ano_eleicao: number
      ds_cargo: string
      sg_partido: string
      nr_turno: number
      ds_sit_tot_turno: string
      total_votos: number
      municipios: Set<string>
    }>()

    // Agrupa votos por município (para componente de geografia)
    const municipiosMapa = new Map<string, number>()

    let nmCandidato = ''
    let nmUrnaCandidato = ''

    for (const r of candidatoRecords) {
      nmCandidato = r.nm_candidato
      nmUrnaCandidato = r.nm_urna_candidato

      const key = `${r.ano_eleicao}-${r.ds_cargo}-${r.nr_turno}`
      const existing = eleicoesMapa.get(key)

      if (existing) {
        existing.total_votos += r.qt_votos_nominais || 0
        existing.municipios.add(r.nm_municipio)
      }
      else {
        eleicoesMapa.set(key, {
          ano_eleicao: r.ano_eleicao,
          ds_cargo: r.ds_cargo,
          sg_partido: r.sg_partido,
          nr_turno: r.nr_turno,
          ds_sit_tot_turno: r.ds_sit_tot_turno,
          total_votos: r.qt_votos_nominais || 0,
          municipios: new Set([r.nm_municipio]),
        })
      }

      // Agregar votos por município
      const votosAtual = municipiosMapa.get(r.nm_municipio) || 0
      municipiosMapa.set(r.nm_municipio, votosAtual + (r.qt_votos_nominais || 0))
    }

    // Converte para array ordenado por ano
    const eleicoes = Array.from(eleicoesMapa.values())
      .map(e => ({
        ...e,
        municipios_count: e.municipios.size,
      }))
      .sort((a, b) => b.ano_eleicao - a.ano_eleicao)

    // Estatísticas gerais
    const totalVotos = eleicoes.reduce((acc, e) => acc + e.total_votos, 0)
    const anosAtivo = [...new Set(eleicoes.map(e => e.ano_eleicao))]
    const partidosUsados = [...new Set(eleicoes.map(e => e.sg_partido))]
    const cargosDisputados = [...new Set(eleicoes.map(e => e.ds_cargo))]
    const vitorias = eleicoes.filter(e =>
      e.ds_sit_tot_turno.toUpperCase().includes('ELEITO')
      && !e.ds_sit_tot_turno.toUpperCase().includes('NÃO ELEITO'),
    ).length

    // Converter mapa de municípios para array ordenado
    const municipiosRanking = Array.from(municipiosMapa.entries())
      .map(([nm_municipio, total_votos]) => ({
        nm_municipio,
        total_votos,
        percentual: totalVotos > 0 ? (total_votos / totalVotos) * 100 : 0,
      }))
      .sort((a, b) => b.total_votos - a.total_votos)

    return {
      nm_candidato: nmCandidato,
      nm_urna_candidato: nmUrnaCandidato,
      sg_uf: parsedSlug.value?.uf || '',
      eleicoes,
      municipiosRanking,
      stats: {
        total_votos: totalVotos,
        anos_ativo: anosAtivo,
        partidos: partidosUsados,
        cargos: cargosDisputados,
        vitorias,
        derrotas: eleicoes.length - vitorias,
      },
    }
  },
  {
    // Cache inteligente: dados eleitorais raramente mudam
    getCachedData(key, nuxtApp, ctx) {
      // Sempre usar cache exceto em refresh manual
      if (ctx.cause === 'refresh:manual')
        return undefined
      // Verificar cache do payload (SSR) ou static
      return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
    },
  },
)

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
})

// Navegação
const router = useRouter()
function goBack() {
  router.back()
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

      <!-- Distribuição Geográfica (lazy - carrega independente) -->
      <LazyCandidatoGeografia
        :municipios="candidatoData.municipiosRanking"
        :total-votos="candidatoData.stats.total_votos"
      />

      <!-- Histórico de Eleições -->
      <div class="px-4 pb-4">
        <p class="text-overline text-medium-emphasis mb-2">
          Histórico de Eleições
        </p>

        <v-timeline side="end" density="compact">
          <v-timeline-item
            v-for="eleicao in candidatoData.eleicoes"
            :key="`${eleicao.ano_eleicao}-${eleicao.ds_cargo}`"
            :dot-color="getSituacaoColor(eleicao.ds_sit_tot_turno)"
            size="small"
          >
            <v-card variant="flat" rounded="lg">
              <v-card-text class="pa-3">
                <div class="d-flex justify-space-between align-start mb-2">
                  <div>
                    <p class="text-body-1 font-weight-medium mb-0">
                      {{ eleicao.ano_eleicao }}
                    </p>
                    <p class="text-caption text-medium-emphasis mb-0">
                      {{ eleicao.ds_cargo }} · {{ eleicao.sg_partido }}
                    </p>
                  </div>
                  <v-chip
                    v-if="formatSituacao(eleicao.ds_sit_tot_turno)"
                    :color="getSituacaoColor(eleicao.ds_sit_tot_turno)"
                    size="x-small"
                  >
                    {{ formatSituacao(eleicao.ds_sit_tot_turno) }}
                  </v-chip>
                </div>

                <div class="d-flex ga-4">
                  <div>
                    <p class="text-body-2 font-weight-bold mb-0">
                      {{ formatNumber(eleicao.total_votos) }}
                    </p>
                    <p class="text-caption text-medium-emphasis mb-0">
                      votos
                    </p>
                  </div>
                  <div>
                    <p class="text-body-2 font-weight-bold mb-0">
                      {{ eleicao.municipios_count }}
                    </p>
                    <p class="text-caption text-medium-emphasis mb-0">
                      municípios
                    </p>
                  </div>
                  <div v-if="eleicao.nr_turno === 2">
                    <v-chip size="x-small" color="info" variant="tonal">
                      2º Turno
                    </v-chip>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-timeline-item>
        </v-timeline>
      </div>
    </div>
  </div>
</template>
