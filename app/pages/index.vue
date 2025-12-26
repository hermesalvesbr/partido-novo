<script setup lang="ts">
import { PostgrestClient } from '@supabase/postgrest-js'

// Dados estáticos para filtros
const anosEleicao = [2024, 2022, 2020, 2018]
const estados = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']

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

const filters = reactive({
  uf: null as string | null,
  ano: null as number | null,
  cidade: null as string | null,
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
const canSearch = computed(() => {
  const hasQuery = searchQuery.value.trim().length >= 3
  const hasFilters = filters.uf !== null || filters.ano !== null || filters.cidade !== null
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
    // Usa view materializada mv_votos_candidato para buscas mais rápidas
    // Se não existir, cai para a tabela original
    const useAggregatedView = true
    const tableName = useAggregatedView ? 'mv_votos_candidato' : 'votacao_candidato_munzona'
    const votosField = useAggregatedView ? 'total_votos' : 'qt_votos_nominais'

    let query = client
      .from(tableName)
      .select(`nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, ${votosField}, ds_sit_tot_turno, nr_turno`)

    // Busca por nome (apenas se tiver termo)
    const term = searchQuery.value.trim()
    if (term.length >= 3) {
      query = query.ilike('nm_candidato', `%${term}%`)
    }

    if (filters.uf) {
      query = query.eq('sg_uf', filters.uf)
    }
    if (filters.ano) {
      query = query.eq('ano_eleicao', filters.ano)
    }

    query = query
      .order(votosField, { ascending: false })
      .limit(50)

    const { data, error: err } = await query

    if (err)
      throw err

    // Normaliza o campo de votos
    candidatos.value = ((data || []) as Record<string, unknown>[]).map(d => ({
      ...d,
      qt_votos_nominais: (d.total_votos ?? d.qt_votos_nominais) as number,
    })) as Candidato[]
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
  <v-container fluid class="pa-0">
    <!-- Search Bar fixo no topo -->
    <v-app-bar flat color="surface" class="px-2">
      <v-text-field
        v-model="searchQuery"
        placeholder="Buscar candidato ou cidade..."
        prepend-inner-icon="mdi-magnify"
        variant="solo-filled"
        flat
        density="comfortable"
        hide-details
        single-line
        rounded
        class="flex-grow-1"
        @keyup.enter="search"
      >
        <template #append-inner>
          <v-btn
            v-if="searchQuery"
            icon="mdi-close"
            size="small"
            variant="text"
            @click="clearAll"
          />
        </template>
      </v-text-field>

      <v-btn
        icon
        variant="text"
        class="ml-2"
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
    </v-app-bar>

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
    <v-main class="bg-grey-lighten-4">
      <div class="pa-4">
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
            mdi-magnify
          </v-icon>
          <p class="text-body-1 text-medium-emphasis">
            Digite o nome de um candidato ou cidade
          </p>
          <p class="text-caption text-medium-emphasis">
            Mínimo 3 caracteres
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

        <!-- Lista de resultados -->
        <v-list v-else bg-color="transparent" class="pa-0">
          <v-list-item
            v-for="(candidato, index) in candidatos"
            :key="index"
            class="mb-2 rounded-lg bg-white"
          >
            <template #prepend>
              <v-avatar color="primary" size="40">
                <span class="text-caption font-weight-bold">
                  {{ candidato.sg_partido?.slice(0, 2) }}
                </span>
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ candidato.nm_urna_candidato || candidato.nm_candidato }}
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption">
              {{ candidato.sg_partido }} · {{ candidato.ds_cargo }}
              <span v-if="candidato.nm_municipio"> · {{ candidato.nm_municipio }}</span>
              - {{ candidato.sg_uf }}
            </v-list-item-subtitle>

            <template #append>
              <div class="text-right">
                <v-chip
                  :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
                  size="x-small"
                  class="mb-1"
                >
                  {{ candidato.ds_sit_tot_turno?.split(' ')[0] }}
                </v-chip>
                <div class="text-caption font-weight-bold">
                  {{ formatNumber(candidato.qt_votos_nominais) }} votos
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ candidato.ano_eleicao }}
                </div>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <!-- Error -->
        <v-alert v-if="error" type="error" variant="tonal" class="mt-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>
      </div>
    </v-main>
  </v-container>
</template>
