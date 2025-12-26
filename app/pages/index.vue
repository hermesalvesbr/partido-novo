<script setup lang="ts">
import { ANOS_ELEICAO, ESTADOS } from '~/data/eleicoes'
import { formatNumber, formatSituacao, getSituacaoColor } from '~/utils/formatters'

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
  canSearch,
  searchPlaceholder,
  searchIcon,
  search,
  clearFilters,
  setUf,
} = useCandidatoSearch()

const {
  cidades,
  loading: loadingCidades,
  loadCidades,
  clearCidades,
} = useCidadesFilter()

const { estadoDetectado } = useGeolocalizacao()

// Estado local do componente (apenas UI)
const showFilters = ref(false)

// Computed: Mostrar filtro de cidade
const showCidadeFilter = computed(() => filters.uf !== null && isEleicaoMunicipal.value)

// Auto-preencher UF baseado na geolocalização
watchEffect(() => {
  if (estadoDetectado.value && filters.uf === null) {
    setUf(estadoDetectado.value)
  }
})

// Carregar cidades quando UF ou ano mudar
watch(
  () => [filters.uf, filters.ano] as const,
  async ([uf, ano]) => {
    filters.cidade = null

    if (!uf || !ano || (ano !== 2020 && ano !== 2024)) {
      clearCidades()
      return
    }

    await loadCidades(uf, ano)
  },
)

// Handlers de UI
function handleSearch(): void {
  showFilters.value = false
  search()
}

function handleClearFilters(): void {
  clearFilters()
}

function handleClearSearch(): void {
  searchQuery.value = ''
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
                v-if="filters.uf || searchType === 'cidade'"
                size="x-small"
                :color="filters.uf ? 'primary' : 'warning'"
                variant="tonal"
                :closable="searchType === 'candidato' && filters.uf !== null"
                @click="showFilters = true"
                @click:close="filters.uf = null"
              >
                <v-icon start size="x-small">
                  mdi-map-marker
                </v-icon>
                {{ filters.uf || 'UF?' }}
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
            @click="handleClearFilters"
          >
            Limpar
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            :disabled="!canSearch"
            @click="handleSearch"
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
                v-if="formatSituacao(candidato.ds_sit_tot_turno)"
                :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
                size="x-small"
                class="mb-1"
              >
                {{ formatSituacao(candidato.ds_sit_tot_turno) }}
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
      <v-alert v-if="error" type="error" variant="tonal" class="mt-4" closable>
        {{ error }}
      </v-alert>
    </div>
  </div>
</template>
