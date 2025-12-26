<script setup lang="ts">
import { PostgrestClient } from '@supabase/postgrest-js'

// Dados estáticos para filtros
const anosEleicao = [2024, 2022, 2020, 2018]
const estados = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']

interface GeoData {
  city: string | null
  region: string | null
  regionCode: string | null
  country: string | null
  countryCode: string | null
  ip: string
  error?: string
}

interface Candidato {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  qt_votos_nominais: number
  ds_sit_tot_turno: string
  nm_municipio?: string
  nr_turno?: number
}

const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.postgrestUrl as string
const client = new PostgrestClient(apiUrl)

const loading = ref(false)
const searched = ref(false)
const showFilters = ref(false)
const searchQuery = ref('')
const candidatos = ref<Candidato[]>([])
const error = ref('')
const cidades = ref<string[]>([])
const loadingCidades = ref(false)

// Tipo de busca: candidato ou cidade
const searchType = ref<'candidato' | 'cidade'>('candidato')

const filters = reactive({
  uf: null as string | null,
  ano: null as number | null,
  cidade: null as string | null,
})

// Placeholder e ícone dinâmicos baseados no tipo de busca
const searchPlaceholder = computed(() =>
  searchType.value === 'candidato'
    ? 'Buscar nome do candidato...'
    : 'Buscar nome da cidade...',
)
const searchIcon = computed(() =>
  searchType.value === 'candidato'
    ? 'mdi-account-search'
    : 'mdi-city-variant',
)

// Busca geolocalização do usuário via IP (Nuxt 4 useAsyncData)
const { data: geoData } = await useAsyncData<GeoData>('user-geo', () => $fetch('/api/geo'), {
  server: true, // Executa no servidor para pegar IP real
  lazy: false,
})

// Preenche o filtro de estado automaticamente baseado na geolocalização
watchEffect(() => {
  if (geoData.value?.regionCode && estados.includes(geoData.value.regionCode)) {
    // Só preenche se o filtro ainda não foi modificado pelo usuário
    if (filters.uf === null) {
      filters.uf = geoData.value.regionCode
    }
  }
})

// Eleições municipais são 2020 e 2024
const isEleicaoMunicipal = computed(() => filters.ano === 2020 || filters.ano === 2024)

// Mostrar campo de cidade: precisa ter UF selecionada e ser eleição municipal
const showCidadeFilter = computed(() => filters.uf !== null && isEleicaoMunicipal.value)

// Carregar cidades quando UF mudar
watch(() => filters.uf, async (novaUf) => {
  filters.cidade = null
  cidades.value = []

  if (!novaUf || !isEleicaoMunicipal.value)
    return

  loadingCidades.value = true
  try {
    const { data } = await client
      .from('votacao_candidato_munzona')
      .select('nm_municipio')
      .eq('sg_uf', novaUf)
      .eq('ano_eleicao', filters.ano!)
      .order('nm_municipio')

    // Remover duplicatas
    const uniqueCidades = [...new Set((data || []).map((d: { nm_municipio: string }) => d.nm_municipio))]
    cidades.value = uniqueCidades.filter(Boolean) as string[]
  }
  catch (e) {
    console.error('Erro ao carregar cidades:', e)
  }
  finally {
    loadingCidades.value = false
  }
})

// Recarregar cidades quando ano mudar (se UF já estiver selecionada)
watch(() => filters.ano, async (novoAno) => {
  if (!filters.uf)
    return
  filters.cidade = null
  cidades.value = []

  if (!novoAno || (novoAno !== 2020 && novoAno !== 2024))
    return

  loadingCidades.value = true
  try {
    const { data } = await client
      .from('votacao_candidato_munzona')
      .select('nm_municipio')
      .eq('sg_uf', filters.uf)
      .eq('ano_eleicao', novoAno)
      .order('nm_municipio')

    const uniqueCidades = [...new Set((data || []).map((d: { nm_municipio: string }) => d.nm_municipio))]
    cidades.value = uniqueCidades.filter(Boolean) as string[]
  }
  catch (e) {
    console.error('Erro ao carregar cidades:', e)
  }
  finally {
    loadingCidades.value = false
  }
})

// Chips de filtros ativos
const activeFilters = computed(() => {
  const chips: { label: string, clear: () => void }[] = []
  if (filters.uf) {
    chips.push({ label: filters.uf, clear: () => filters.uf = null })
  }
  if (filters.ano) {
    chips.push({ label: String(filters.ano), clear: () => filters.ano = null })
  }
  if (filters.cidade) {
    chips.push({ label: filters.cidade, clear: () => filters.cidade = null })
  }
  return chips
})

// Validação: requer pelo menos 3 caracteres OU filtros selecionados
// Para busca por cidade, UF é obrigatória
const canSearch = computed(() => {
  const hasQuery = searchQuery.value.trim().length >= 3
  const hasFilters = filters.uf !== null || filters.ano !== null || filters.cidade !== null

  // Busca por cidade exige UF
  if (searchType.value === 'cidade' && !filters.uf) {
    return false
  }

  return hasQuery || hasFilters
})

async function search(): Promise<void> {
  if (!canSearch.value)
    return

  loading.value = true
  searched.value = true
  error.value = ''
  showFilters.value = false

  try {
    // Ambas as buscas usam a tabela base que tem índice GIN trigram
    // A view materializada não tem índice GIN, então ILIKE %termo% é lento
    const tableName = 'votacao_candidato_munzona'
    const votosField = 'qt_votos_nominais'

    // Campos para busca
    const selectFields = `nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, ${votosField}, ds_sit_tot_turno, nr_turno, nm_municipio`

    let query = client
      .from(tableName)
      .select(selectFields)

    // Busca por nome do candidato ou cidade dependendo do tipo
    const term = searchQuery.value.trim()
    if (term.length >= 3) {
      // Substitui espaços por % para busca mais flexível (encontra "NUNES RAFAEL" com "nunes rafael")
      const termPattern = `%${term.replace(/\s+/g, '%')}%`

      if (searchType.value === 'candidato') {
        // Busca pelo nome de urna (mais comum para usuários)
        query = query.ilike('nm_urna_candidato', termPattern)
      }
      else {
        // Busca por cidade - UF é obrigatória (já validado em canSearch)
        query = query.ilike('nm_municipio', termPattern)
      }
    }

    // Filtros: Para busca por candidato, não aplica UF nem ano (mostra trajetória completa)
    // Para busca por cidade, aplica UF (obrigatório) e ano (opcional)
    if (searchType.value === 'cidade') {
      if (filters.uf) {
        query = query.eq('sg_uf', filters.uf)
      }
      if (filters.ano) {
        query = query.eq('ano_eleicao', filters.ano)
      }
    }

    query = query
      .order(votosField, { ascending: false })
      .limit(500) // Busca mais registros para agregar depois

    const { data, error: err } = await query

    if (err)
      throw err

    // Agrupa resultados por candidato + ano + cargo + UF (soma votos por zona/município)
    const rawData = (data || []) as unknown as Record<string, unknown>[]

    if (searchType.value === 'candidato') {
      // Agrupar por candidato/ano/cargo/uf para somar votos
      const grouped = new Map<string, Candidato>()

      for (const d of rawData) {
        // Usa nm_urna_candidato como chave principal (é o nome que o usuário busca)
        const key = `${d.nm_urna_candidato}-${d.ano_eleicao}-${d.ds_cargo}-${d.sg_uf}-${d.nr_turno}`
        const existing = grouped.get(key)

        if (existing) {
          existing.qt_votos_nominais += (d.qt_votos_nominais as number) || 0
        }
        else {
          grouped.set(key, {
            nm_candidato: d.nm_candidato as string,
            nm_urna_candidato: d.nm_urna_candidato as string,
            sg_partido: d.sg_partido as string,
            ds_cargo: d.ds_cargo as string,
            ano_eleicao: d.ano_eleicao as number,
            sg_uf: d.sg_uf as string,
            qt_votos_nominais: (d.qt_votos_nominais as number) || 0,
            ds_sit_tot_turno: d.ds_sit_tot_turno as string,
            nr_turno: d.nr_turno as number,
          })
        }
      }

      // Ordena por votos e limita
      candidatos.value = Array.from(grouped.values())
        .sort((a, b) => b.qt_votos_nominais - a.qt_votos_nominais)
        .slice(0, 50)
    }
    else {
      // Busca por cidade: mantém registros individuais
      candidatos.value = rawData.map(d => ({
        ...d,
        qt_votos_nominais: (d.qt_votos_nominais as number) || 0,
      })) as Candidato[]
    }
  }
  catch (e: unknown) {
    const err = e as Error
    error.value = err.message || 'Erro na busca'
  }
  finally {
    loading.value = false
  }
}

function clearAll(): void {
  searchQuery.value = ''
  filters.uf = null
  filters.ano = null
  filters.cidade = null
  cidades.value = []
  candidatos.value = []
  searched.value = false
  error.value = ''
}

function formatNumber(num: number): string {
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString('pt-BR')
}

function getSituacaoColor(situacao: string): string {
  if (!situacao)
    return 'grey'
  const s = situacao.toUpperCase()
  if (s.includes('ELEITO'))
    return 'success'
  if (s.includes('NÃO ELEITO'))
    return 'error'
  if (s.includes('2º TURNO'))
    return 'warning'
  return 'grey'
}
</script>

<template>
  <v-container fluid class="pa-0 d-flex flex-column" style="min-height: 100vh;">
    <!-- Search Bar fixo no topo com tabs de tipo de busca -->
    <v-sheet color="surface" class="px-4 py-3 flex-shrink-0" elevation="1">
      <!-- Toggle entre Candidato e Cidade -->
      <v-btn-toggle
        v-model="searchType"
        mandatory
        density="compact"
        variant="outlined"
        divided
        rounded="pill"
        color="primary"
        class="d-flex justify-center mb-3"
      >
        <v-btn value="candidato" size="small" min-width="100">
          <v-icon start size="small">
            mdi-account-search
          </v-icon>
          <span class="d-none d-sm-inline">Candidato</span>
          <span class="d-sm-none">Pessoa</span>
        </v-btn>
        <v-btn value="cidade" size="small" min-width="100">
          <v-icon start size="small">
            mdi-city
          </v-icon>
          <span>Cidade</span>
        </v-btn>
      </v-btn-toggle>

      <!-- Campo de busca dinâmico -->
      <div class="d-flex align-center ga-2">
        <v-text-field
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          :prepend-inner-icon="searchIcon"
          variant="solo-filled"
          flat
          density="comfortable"
          hide-details
          single-line
          rounded
          class="flex-grow-1"
          :disabled="searchType === 'cidade' && !filters.uf"
          @keyup.enter="search"
        >
          <template #append-inner>
            <!-- Chip mostrando UF quando busca por cidade -->
            <v-fade-transition>
              <v-chip
                v-if="searchType === 'cidade'"
                size="x-small"
                :color="filters.uf ? 'primary' : 'warning'"
                variant="tonal"
                class="mr-1"
                @click="showFilters = true"
              >
                <v-icon start size="x-small">
                  mdi-map-marker
                </v-icon>
                {{ filters.uf || 'UF?' }}
              </v-chip>
            </v-fade-transition>
            <v-btn
              v-if="searchQuery"
              icon="mdi-close"
              size="x-small"
              variant="text"
              @click="clearAll"
            />
          </template>
        </v-text-field>

        <v-btn
          icon
          variant="text"
          @click="showFilters = !showFilters"
        >
          <v-badge
            v-if="activeFilters.length > 0"
            :content="activeFilters.length"
            color="primary"
          >
            <v-icon>mdi-filter-variant</v-icon>
          </v-badge>
          <v-icon v-else>
            mdi-filter-variant
          </v-icon>
        </v-btn>
      </div>
    </v-sheet>

    <!-- Alerta quando busca por cidade sem UF selecionada -->
    <v-slide-y-transition>
      <v-alert
        v-if="searchType === 'cidade' && !filters.uf"
        type="info"
        variant="tonal"
        density="compact"
        class="ma-4 mb-0 rounded-lg"
        closable
      >
        <template #prepend>
          <v-icon>mdi-map-marker-alert</v-icon>
        </template>
        <span class="text-body-2">
          Selecione um <strong>estado (UF)</strong> para buscar por cidade
        </span>
        <template #append>
          <v-btn
            variant="tonal"
            size="small"
            color="info"
            class="ml-2"
            @click="showFilters = true"
          >
            Filtros
          </v-btn>
        </template>
      </v-alert>
    </v-slide-y-transition>

    <!-- Filtros em Bottom Sheet -->
    <v-bottom-sheet v-model="showFilters" inset>
      <v-card class="rounded-t-xl">
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Filtros</span>
          <v-btn icon="mdi-close" variant="text" @click="showFilters = false" />
        </v-card-title>

        <v-card-text>
          <v-select
            v-model="filters.ano"
            :items="anosEleicao"
            label="Ano da Eleição"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            class="mb-4"
          />

          <v-select
            v-model="filters.uf"
            :items="estados"
            label="Estado (UF)"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            class="mb-4"
          />

          <v-autocomplete
            v-if="showCidadeFilter"
            v-model="filters.cidade"
            :items="cidades"
            :loading="loadingCidades"
            label="Cidade"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            no-data-text="Selecione um estado primeiro"
          />
        </v-card-text>

        <v-card-actions class="pa-4">
          <v-btn
            variant="text"
            @click="filters.uf = null; filters.ano = null; filters.cidade = null"
          >
            Limpar
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!canSearch"
            @click="search"
          >
            Aplicar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Conteúdo principal -->
    <div class="flex-grow-1 bg-grey-lighten-4 pa-4 overflow-y-auto">
      <!-- Chips de filtros ativos -->
      <div v-if="activeFilters.length > 0" class="mb-4">
        <v-chip
          v-for="(filter, i) in activeFilters"
          :key="i"
          closable
          size="small"
          class="mr-2"
          @click:close="filter.clear(); search()"
        >
          {{ filter.label }}
        </v-chip>
      </div>

      <!-- Estado inicial -->
      <div v-if="!searched && !loading" class="text-center py-16">
        <v-icon size="64" color="grey-lighten-1" class="mb-4">
          {{ searchType === 'candidato' ? 'mdi-account-search-outline' : 'mdi-city-variant-outline' }}
        </v-icon>
        <p class="text-body-1 text-medium-emphasis">
          {{ searchType === 'candidato' ? 'Busque por nome do candidato' : 'Busque por nome da cidade' }}
        </p>
        <p class="text-caption text-medium-emphasis">
          Mínimo 3 caracteres{{ searchType === 'cidade' ? ' • UF obrigatória' : '' }}
        </p>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="text-center py-16">
        <v-progress-circular indeterminate color="primary" size="48" />
        <p class="mt-4 text-medium-emphasis">
          Buscando...
        </p>
      </div>

      <!-- Sem resultados -->
      <div v-else-if="searched && candidatos.length === 0" class="text-center py-16">
        <v-icon size="64" color="grey-lighten-1" class="mb-4">
          mdi-magnify-close
        </v-icon>
        <p class="text-body-1 text-medium-emphasis">
          Nenhum resultado encontrado
        </p>
      </div>

      <!-- Lista de resultados usando cards -->
      <div v-else class="d-flex flex-column ga-3">
        <p class="text-caption text-medium-emphasis mb-0">
          {{ candidatos.length }} resultado(s) encontrado(s)
        </p>

        <v-card
          v-for="candidato in candidatos"
          :key="`${candidato.nm_urna_candidato}-${candidato.ano_eleicao}-${candidato.ds_cargo}`"
          variant="flat"
          rounded="lg"
        >
          <v-card-text class="d-flex align-center ga-3 pa-3">
            <!-- Avatar com sigla do partido -->
            <v-avatar color="primary" size="48" class="flex-shrink-0">
              <span class="text-body-2 font-weight-bold">
                {{ candidato.sg_partido?.slice(0, 2) }}
              </span>
            </v-avatar>

            <!-- Informações do candidato -->
            <div class="flex-grow-1 overflow-hidden">
              <p class="text-body-1 font-weight-medium text-truncate mb-0">
                {{ candidato.nm_urna_candidato || candidato.nm_candidato }}
              </p>
              <p class="text-caption text-medium-emphasis mb-0">
                {{ candidato.sg_partido }} · {{ candidato.ds_cargo }}
                <span v-if="candidato.nm_municipio"> · {{ candidato.nm_municipio }}</span>
                - {{ candidato.sg_uf }}
              </p>
            </div>

            <!-- Votos e ano -->
            <div class="text-right flex-shrink-0">
              <v-chip
                :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
                size="x-small"
                class="mb-1"
              >
                {{ candidato.ds_sit_tot_turno?.split(' ')[0] || '—' }}
              </v-chip>
              <p class="text-body-2 font-weight-bold mb-0">
                {{ formatNumber(candidato.qt_votos_nominais) }} votos
              </p>
              <p class="text-caption text-medium-emphasis mb-0">
                {{ candidato.ano_eleicao }}
              </p>
            </div>
          </v-card-text>
        </v-card>
      </div>

      <!-- Error -->
      <v-alert v-if="error" type="error" variant="tonal" class="mt-4" closable @click:close="error = ''">
        {{ error }}
      </v-alert>
    </div>
  </v-container>
</template>
