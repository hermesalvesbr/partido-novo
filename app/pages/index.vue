<script setup lang="ts">
import type { AnoEleicao, Cargo } from '~/data/eleicoes'
import { ANOS_ELEICAO, ESTADOS, TIPOS_ELEICAO } from '~/data/eleicoes'

// SEO Meta Tags
useSeoMeta({
  title: 'Buscar Candidatos',
  description: 'Pesquise candidatos por nome ou cidade. Consulte dados eleitorais do TSE, histórico de votos e resultados de eleições em todo o Brasil.',
  ogTitle: 'Buscar Candidatos | NOVO Pernambuco',
  ogDescription: 'Pesquise candidatos por nome ou cidade. Consulte dados eleitorais do TSE e histórico de eleições.',
  twitterTitle: 'Buscar Candidatos | NOVO Pernambuco',
  twitterDescription: 'Pesquise candidatos por nome ou cidade. Consulte dados eleitorais do TSE e histórico de eleições.',
})

// Composables para separação de responsabilidades
const {
  loading,
  searched,
  error,
  candidatos,
  searchQuery,
  searchType,
  filters,
  isEleicaoMunicipal,
  filterCount,
  searchPlaceholder,
  searchIcon,
  search,
  clearResults,
  clearFilters,
  setUf,
} = useCandidatoSearch()

const {
  cidades,
  loadCidades,
  clearCidades,
} = useCidadesFilter()

// Preferência de UF: prioridade cookie > geolocalização
const {
  ufEfetivo,
  hasUserPreference,
  saveUfPreference,
  clearUfPreference,
} = useUfPreference()

// Estado local do componente (apenas UI)
const showFilters = ref(false)

// Computed: Mostrar filtro de cidade
const showCidadeFilter = computed(() => filters.uf !== null && isEleicaoMunicipal.value)

// Computed: Cargos disponíveis para o ano selecionado
const cargosDisponiveis = computed((): readonly Cargo[] => {
  if (!filters.ano)
    return []
  return TIPOS_ELEICAO[filters.ano as AnoEleicao]?.cargos ?? []
})

// Limpar cargo quando o ano mudar
watch(
  () => filters.ano,
  () => {
    filters.cargo = null
  },
)

// Limpar resultados quando o usuário começar a DIGITAR nova busca
// Apenas para busca por candidato (texto livre)
// Para busca por cidade, a mudança vem do v-select (seleção intencional)
watch(searchQuery, () => {
  if (searched.value && searchType.value === 'candidato') {
    clearResults()
  }
})

// Auto-preencher UF baseado na preferência (cookie > geolocalização)
watchEffect(() => {
  if (ufEfetivo.value && filters.uf === null) {
    setUf(ufEfetivo.value)
  }
})

// Salvar preferência quando usuário selecionar UF manualmente
watch(
  () => filters.uf,
  (newUf, oldUf) => {
    // Só salva se o usuário mudou manualmente (não é null e mudou de valor)
    // Ignora a primeira atribuição automática do ufEfetivo
    if (newUf !== null && oldUf !== undefined) {
      saveUfPreference(newUf)
    }
    // Se limpou o filtro manualmente, limpa a preferência também
    if (newUf === null && oldUf !== null && hasUserPreference.value) {
      clearUfPreference()
    }
  },
)

// Carregar cidades quando UF ou tipo de busca mudar
watch(
  () => [filters.uf, searchType.value] as const,
  async ([uf, type]) => {
    filters.cidade = null

    // Limpa a cidade selecionada quando UF muda (cidades são diferentes por estado)
    if (type === 'cidade') {
      searchQuery.value = ''
      clearResults()
    }

    // Se não tem UF, limpa cidades
    if (!uf) {
      clearCidades()
      return
    }

    // Para busca por cidade: sempre carrega cidades
    if (type === 'cidade') {
      await loadCidades(uf)
      return
    }

    // Para busca por candidato: só carrega em eleições municipais
    if (isEleicaoMunicipal.value) {
      await loadCidades(uf)
    }
    else {
      clearCidades()
    }
  },
  { immediate: true },
)

// Handlers de UI
function handleSearch(): void {
  showFilters.value = false
  search()
}

// Handler para o botão Aplicar do bottom sheet de filtros
// Apenas fecha o bottom sheet - o usuário vai selecionar a cidade no campo principal
function handleApplyFilters(): void {
  showFilters.value = false
}

function handleClearFilters(): void {
  clearFilters()
}

function handleClearSearch(): void {
  searchQuery.value = ''
  clearResults()
}
</script>

<template>
  <div class="d-flex flex-column fill-height w-100">
    <!-- Search Bar fixo no topo com tabs de tipo de busca -->
    <v-sheet color="surface" class="px-4 py-3 flex-shrink-0 w-100" elevation="1">
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
        <!-- Busca por Candidato: texto livre -->
        <v-text-field
          v-if="searchType === 'candidato'"
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
          @keyup.enter="handleSearch"
        >
          <template #append-inner>
            <!-- Chips de filtros dentro da busca -->
            <div class="d-flex align-center ga-1">
              <!-- Chip de Ano -->
              <v-chip
                v-if="filters.ano"
                size="x-small"
                color="secondary"
                variant="tonal"
                closable
                @click="showFilters = true"
                @click:close="filters.ano = null"
              >
                {{ filters.ano }}
              </v-chip>
              <!-- Chip de UF -->
              <v-chip
                v-if="filters.uf"
                size="x-small"
                color="primary"
                variant="tonal"
                closable
                @click="showFilters = true"
                @click:close="filters.uf = null"
              >
                <v-icon start size="x-small">
                  mdi-map-marker
                </v-icon>
                {{ filters.uf }}
              </v-chip>
              <!-- Botão limpar busca -->
              <v-btn
                v-if="searchQuery"
                icon="mdi-close"
                size="x-small"
                variant="text"
                @click="handleClearSearch"
              />
            </div>
          </template>
        </v-text-field>

        <!-- Busca por Cidade: autocomplete -->
        <v-autocomplete
          v-else
          v-model="searchQuery"
          :items="cidades"
          :placeholder="filters.uf ? 'Buscar nome da cidade...' : 'Selecione um estado primeiro'"
          :prepend-inner-icon="searchIcon"
          :disabled="!filters.uf"
          :no-data-text="filters.uf ? 'Nenhuma cidade encontrada' : 'Selecione um estado (UF) primeiro'"
          variant="solo-filled"
          flat
          density="comfortable"
          hide-details
          rounded
          class="flex-grow-1"
          auto-select-first
          clearable
          @update:model-value="handleSearch"
        >
          <template #append-inner>
            <!-- Chips de filtros dentro da busca -->
            <div class="d-flex align-center ga-1">
              <!-- Chip de Ano -->
              <v-chip
                v-if="filters.ano"
                size="x-small"
                color="secondary"
                variant="tonal"
                closable
                @click="showFilters = true"
                @click:close="filters.ano = null"
              >
                {{ filters.ano }}
              </v-chip>
              <!-- Chip de UF (obrigatório para cidade) -->
              <v-chip
                size="x-small"
                :color="filters.uf ? 'primary' : 'warning'"
                variant="tonal"
                @click="showFilters = true"
              >
                <v-icon start size="x-small">
                  mdi-map-marker
                </v-icon>
                {{ filters.uf || 'UF?' }}
              </v-chip>
            </div>
          </template>
        </v-autocomplete>

        <v-btn
          icon
          variant="text"
          @click="showFilters = !showFilters"
        >
          <v-badge
            v-if="filterCount > 0"
            :content="filterCount"
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
            :items="ANOS_ELEICAO"
            label="Ano da Eleição"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            class="mb-4"
          />

          <v-select
            v-model="filters.uf"
            :items="ESTADOS"
            label="Estado (UF)"
            variant="outlined"
            density="comfortable"
            :clearable="searchType === 'candidato'"
            hide-details
            class="mb-4"
          />

          <v-select
            v-model="filters.cargo"
            :items="cargosDisponiveis"
            label="Cargo"
            variant="outlined"
            density="comfortable"
            clearable
            hide-details
            :disabled="!filters.ano"
            class="mb-4"
          />

          <v-autocomplete
            v-if="showCidadeFilter"
            v-model="filters.cidade"
            :items="cidades"
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
            @click="handleClearFilters"
          >
            Limpar
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            @click="handleApplyFilters"
          >
            Aplicar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-bottom-sheet>

    <!-- Conteúdo principal -->
    <div class="flex-grow-1 w-100 bg-grey-lighten-4 px-3 py-4 overflow-y-auto">
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
      <div v-else class="d-flex flex-column ga-3 w-100">
        <p class="text-caption text-medium-emphasis mb-0">
          {{ candidatos.length }} resultado(s) encontrado(s)
        </p>

        <CandidatoCard
          v-for="candidato in candidatos"
          :key="`${candidato.nm_urna_candidato}-${candidato.ano_eleicao}-${candidato.ds_cargo}`"
          :candidato="candidato"
          variant="card"
        />
      </div>

      <!-- Error -->
      <v-alert v-if="error" type="error" variant="tonal" class="mt-4" closable>
        {{ error }}
      </v-alert>
    </div>
  </div>
</template>
