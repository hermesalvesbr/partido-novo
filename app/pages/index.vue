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
  loading: searchLoading,
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
  loading: loadingCidades,
  loadCidades,
  clearCidades,
} = useCidadesFilter()

// Typeahead para busca instantânea de candidatos
const {
  inputValue: typeaheadInput,
  suggestions,
  isLoading: typeaheadLoading,
  setUf: setTypeaheadUf,
  clearSuggestions,
} = useCandidatoTypeahead()

// Trending: candidatos mais acessados da UF
const { useTrending } = useTrendingCandidatos()
const ufRef = computed(() => filters.uf)
const { trending, hasTrending, loading: trendingLoading } = useTrending(ufRef)

// Loading indicator (barra laranja do topo)
const { start: startLoading, finish: finishLoading } = useLoadingIndicator()

// Computed: Loading unificado (typeahead ou busca completa)
const loading = computed(() => searchLoading.value || typeaheadLoading.value)

// Sincronizar loading com barra do topo
watch(loading, (isLoading) => {
  if (isLoading) {
    startLoading()
  }
  else {
    finishLoading()
  }
})

// Computed: Mostrar sugestões do typeahead
// Mostra quando: modo candidato + tem sugestões + (não buscou ainda OU está digitando algo novo)
const showSuggestions = computed(() => {
  if (searchType.value !== 'candidato') return false
  if (suggestions.value.length === 0) return false
  // Se não fez busca completa ainda, mostra sugestões
  if (!searched.value) return true
  // Se está digitando algo diferente da busca anterior, mostra sugestões
  // (o usuário quer uma nova busca)
  return typeaheadInput.value.trim().length >= 3 && candidatos.value.length === 0
})

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

// REMOVIDO: O watch que limpava resultados ao digitar foi removido
// Isso quebrava a persistência da busca ao navegar e voltar
// Agora os resultados só são limpos ao fazer nova busca com Enter

// Limpar busca e resultados quando mudar entre CANDIDATO ↔ CIDADE
// Porque searchQuery tem significados diferentes em cada modo
watch(searchType, () => {
  searchQuery.value = ''
  typeaheadInput.value = ''
  clearResults()
  clearSuggestions()
})

// Sincronizar typeahead input com searchQuery (modo candidato)
// Permite que o typeahead reaja à digitação
watch(searchQuery, (newValue) => {
  if (searchType.value === 'candidato') {
    typeaheadInput.value = newValue
  }
}, { immediate: true }) // immediate: sincroniza na montagem se já tiver valor

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
    // Sincroniza UF com typeahead
    setTypeaheadUf(newUf)
  },
  { immediate: true }, // Sincroniza na montagem também
)

// Carregar cidades quando UF, tipo de busca ou ano mudar
// Importante: observar isEleicaoMunicipal para reagir a mudanças de ano
// Guarda UF anterior para detectar mudança real vs remontagem
const previousUf = ref<string | null>(null)

watch(
  () => [filters.uf, searchType.value, isEleicaoMunicipal.value] as const,
  async ([uf, type, isMunicipal]) => {
    // Detecta se a UF realmente mudou (não é apenas remontagem da página)
    const ufChanged = previousUf.value !== null && previousUf.value !== uf
    previousUf.value = uf

    // Só limpa cidade/resultados se UF realmente mudou
    if (ufChanged) {
      filters.cidade = null
      if (type === 'cidade') {
        searchQuery.value = ''
        clearResults()
      }
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
    if (isMunicipal) {
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
  clearSuggestions() // Limpa sugestões ao fazer busca completa
  search()
}

// Handler para o botão Aplicar do bottom sheet de filtros
// Fecha o bottom sheet e refaz a busca com os novos filtros
function handleApplyFilters(): void {
  showFilters.value = false
  // Refaz a busca se já tiver feito uma busca antes (tem contexto)
  if (searched.value || searchQuery.value.trim().length >= 3) {
    search()
  }
}

function handleClearFilters(): void {
  clearFilters()
}

function handleClearSearch(): void {
  searchQuery.value = ''
  typeaheadInput.value = ''
  clearResults()
  clearSuggestions()
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
            :loading="loadingCidades"
            :no-data-text="loadingCidades ? 'Carregando cidades...' : 'Nenhuma cidade encontrada'"
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
      <!-- Sugestões do Typeahead (modo candidato, enquanto digita) -->
      <div v-if="showSuggestions" class="d-flex flex-column ga-3 w-100">
        <p class="text-caption text-medium-emphasis mb-0">
          {{ suggestions.length }} sugestão(ões) • Enter para busca completa
        </p>

        <CandidatoCard
          v-for="candidato in suggestions"
          :key="`sug-${candidato.nm_urna_candidato}-${candidato.ano_eleicao}-${candidato.ds_cargo}`"
          :candidato="candidato"
          variant="card"
        />
      </div>

      <!-- Estado inicial (sem sugestões e sem busca) -->
      <div v-else-if="!searched && !loading && !typeaheadLoading" class="py-4">
        <!-- Trending: Candidatos mais buscados da UF -->
        <template v-if="hasTrending && searchType === 'candidato'">
          <div class="d-flex align-center mb-3">
            <v-icon color="orange" size="20" class="mr-2">
              mdi-fire
            </v-icon>
            <span class="text-body-2 font-weight-medium text-medium-emphasis">
              Mais buscados em {{ filters.uf }}
            </span>
          </div>

          <div class="d-flex flex-column ga-3 mb-6">
            <CandidatoCard
              v-for="(candidato, index) in trending"
              :key="`trending-${candidato.slug}`"
              :candidato="{
                nm_candidato: candidato.nomeCompleto,
                nm_urna_candidato: candidato.nome,
                sg_partido: candidato.partido,
                ds_cargo: candidato.cargo,
                sg_uf: filters.uf || '',
                ds_sit_tot_turno: candidato.situacao,
                ano_eleicao: candidato.anoEleicao,
                total_votos: candidato.totalVotos,
              }"
              :rank="index + 1"
              variant="card"
            />
          </div>
        </template>

        <!-- Loading trending -->
        <template v-else-if="trendingLoading && searchType === 'candidato' && filters.uf">
          <div class="d-flex align-center mb-3">
            <v-icon color="orange" size="20" class="mr-2">
              mdi-fire
            </v-icon>
            <span class="text-body-2 font-weight-medium text-medium-emphasis">
              Carregando mais buscados...
            </span>
          </div>
          <div class="d-flex flex-column ga-3 mb-6">
            <v-skeleton-loader
              v-for="i in 3"
              :key="i"
              type="list-item-avatar-two-line"
              class="rounded-lg"
            />
          </div>
        </template>

        <!-- Instrução de busca -->
        <div class="text-center" :class="{ 'py-12': !hasTrending }">
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
      </div>

      <!-- Loading: Skeleton de cards -->
      <div v-else-if="loading" class="d-flex flex-column ga-3 w-100">
        <v-skeleton-loader
          v-for="i in 4"
          :key="i"
          type="list-item-avatar-two-line"
          class="rounded-lg"
        />
      </div>

      <!-- Sem resultados (apenas após busca completa) -->
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
