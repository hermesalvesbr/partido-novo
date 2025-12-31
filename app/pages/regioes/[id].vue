<script setup lang="ts">
import type { MunicipioIBGE } from '~/composables/useMesorregiao'
import type { Cargo } from '~/data/eleicoes'
import { ANOS_ELEICAO, TIPOS_ELEICAO } from '~/data/eleicoes'
import { formatNumber } from '~/utils/formatters'

// Pegar ID da mesorregião da rota
const route = useRoute()
const mesorregiaoId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

// Buscar dados da mesorregião e municípios (rápido - IBGE)
const { mesorregiao, municipios, loading: loadingMeso } = useMesorregiao(mesorregiaoId)

// SEO Meta - título dinâmico baseado na mesorregião
useSeoMeta({
  title: () => mesorregiao.value?.nome ?? 'Mesorregião',
  description: () => mesorregiao.value
    ? `Explore candidatos e dados eleitorais da mesorregião ${mesorregiao.value.nome} (${mesorregiao.value.UF?.sigla}). ${municipios.value?.length ?? 0} municípios disponíveis para consulta.`
    : 'Explore candidatos e dados eleitorais por mesorregião geográfica do IBGE.',
  ogTitle: () => mesorregiao.value?.nome
    ? `${mesorregiao.value.nome} | NOVO Pernambuco`
    : 'Mesorregião | NOVO Pernambuco',
  ogDescription: () => mesorregiao.value
    ? `Candidatos e dados eleitorais da mesorregião ${mesorregiao.value.nome}. ${municipios.value?.length ?? 0} municípios.`
    : 'Explore candidatos e dados eleitorais por mesorregião.',
  twitterTitle: () => mesorregiao.value?.nome
    ? `${mesorregiao.value.nome} | NOVO Pernambuco`
    : 'Mesorregião | NOVO Pernambuco',
  twitterDescription: () => mesorregiao.value
    ? `Candidatos da mesorregião ${mesorregiao.value.nome}. ${municipios.value?.length ?? 0} municípios.`
    : 'Explore candidatos e dados eleitorais por mesorregião.',
})

// UF da mesorregião
const uf = computed(() => mesorregiao.value?.UF?.sigla ?? null)

// ===== ESTADO PERSISTENTE (via useState) =====
// Usa composable para persistir estado E RESULTADOS entre navegações
const {
  municipiosSelecionados,
  anoSelecionado,
  cargoSelecionado,
  consultaIniciada,
  candidatos,
  stats,
  loading: loadingCandidatos,
  initMunicipios,
  removerMunicipio,
  restaurarTodos,
  marcarConsultaIniciada,
  buscarCandidatos,
} = useRegiaoConsulta(mesorregiaoId)

// Controle de loading local (não precisa persistir)
const consultando = ref(false)

// Inicializar municípios selecionados quando carregar
watch(municipios, (novos) => {
  if (novos && novos.length > 0) {
    initMunicipios(novos)
  }
}, { immediate: true })

// Nomes dos municípios selecionados (para busca)
const nomesMunicipiosSelecionados = computed(() =>
  municipiosSelecionados.value.map((m: MunicipioIBGE) => m.nome.toUpperCase()),
)

// Cargos disponíveis baseado no ano (usando dados centralizados)
const cargosDisponiveis = computed((): readonly Cargo[] => {
  return TIPOS_ELEICAO[anoSelecionado.value]?.cargos ?? []
})

// Limpar cargo quando o ano mudar
watch(anoSelecionado, () => {
  cargoSelecionado.value = null
})

// Handler para restaurar todos os municípios
function handleRestaurarTodos(): void {
  if (municipios.value) {
    restaurarTodos(municipios.value)
  }
}

// Iniciar consulta
async function iniciarConsulta(): Promise<void> {
  if (municipiosSelecionados.value.length === 0)
    return

  consultando.value = true
  marcarConsultaIniciada()

  try {
    await buscarCandidatos(uf.value, nomesMunicipiosSelecionados.value)
  }
  finally {
    consultando.value = false
  }
}

// Top 20 candidatos para exibição
const topCandidatos = computed(() => candidatos.value.slice(0, 20))
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- Header -->
    <v-app-bar flat color="surface" elevation="1">
      <v-btn icon="mdi-arrow-left" @click="navigateTo('/regioes')" />
      <v-app-bar-title>
        {{ mesorregiao?.nome ?? 'Carregando...' }}
      </v-app-bar-title>
      <template #append>
        <v-chip v-if="mesorregiao" color="primary" variant="tonal" size="small">
          {{ mesorregiao.UF?.sigla }} · {{ municipios?.length ?? 0 }} municípios
        </v-chip>
      </template>
    </v-app-bar>

    <div class="flex-grow-1 overflow-y-auto bg-grey-lighten-4 pb-4">
      <!-- Loading inicial -->
      <div v-if="loadingMeso && !mesorregiao" class="pa-4">
        <v-card rounded="lg" class="pa-8 text-center">
          <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
          <div class="text-body-1 text-medium-emphasis">
            Carregando região...
          </div>
        </v-card>
      </div>

      <template v-else-if="mesorregiao">
        <!-- ETAPA 1: Seleção de municípios e filtros -->
        <div class="px-4 pt-4">
          <v-card rounded="lg" elevation="0" class="pa-4">
            <!-- Header da seção -->
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="d-flex align-center">
                <v-icon color="primary" size="20" class="mr-2">
                  mdi-city
                </v-icon>
                <span class="text-subtitle-2 font-weight-medium">Municípios para análise</span>
              </div>
              <div class="d-flex align-center gap-2">
                <v-chip
                  size="small"
                  :color="municipiosSelecionados.length === municipios?.length ? 'success' : 'warning'"
                  variant="tonal"
                >
                  {{ municipiosSelecionados.length }} de {{ municipios?.length ?? 0 }}
                </v-chip>
                <v-btn
                  v-if="municipiosSelecionados.length < (municipios?.length ?? 0)"
                  size="x-small"
                  variant="text"
                  color="primary"
                  @click="handleRestaurarTodos"
                >
                  Restaurar todos
                </v-btn>
              </div>
            </div>

            <!-- Chips de municípios removíveis -->
            <div class="d-flex flex-wrap gap-1 mb-4" style="max-height: 200px; overflow-y: auto;">
              <v-chip
                v-for="mun in municipiosSelecionados"
                :key="mun.id"
                size="small"
                variant="tonal"
                color="primary"
                closable
                @click:close="removerMunicipio(mun)"
              >
                {{ mun.nome }}
              </v-chip>

              <v-alert
                v-if="municipiosSelecionados.length === 0"
                type="warning"
                variant="tonal"
                density="compact"
                class="w-100"
              >
                Nenhum município selecionado. Clique em "Restaurar todos".
              </v-alert>
            </div>

            <v-divider class="mb-4" />

            <!-- Filtros -->
            <div class="d-flex flex-wrap gap-2 mb-4">
              <!-- Ano -->
              <v-select
                v-model="anoSelecionado"
                :items="ANOS_ELEICAO"
                label="Ano da Eleição"
                variant="outlined"
                density="compact"
                hide-details
                style="min-width: 130px; max-width: 150px;"
              />

              <!-- Cargo -->
              <v-select
                v-model="cargoSelecionado"
                :items="cargosDisponiveis"
                label="Cargo"
                variant="outlined"
                density="compact"
                hide-details
                clearable
                placeholder="Todos"
                style="min-width: 150px; flex: 1;"
              />
            </div>

            <!-- Botão de consulta -->
            <v-btn
              color="primary"
              size="large"
              block
              :loading="consultando"
              :disabled="municipiosSelecionados.length === 0"
              @click="iniciarConsulta"
            >
              <v-icon start>
                mdi-magnify
              </v-icon>
              {{ consultaIniciada ? 'Atualizar Consulta' : 'Consultar Candidatos' }}
            </v-btn>
          </v-card>
        </div>

        <!-- ETAPA 2: Resultados (só aparece após consulta) -->
        <template v-if="consultaIniciada">
          <!-- Loading de candidatos -->
          <div v-if="consultando || loadingCandidatos" class="px-4 pt-4">
            <v-card rounded="lg" class="pa-6 text-center">
              <v-progress-circular indeterminate color="primary" size="48" class="mb-4" />
              <div class="text-body-1 text-medium-emphasis">
                Buscando candidatos em {{ municipiosSelecionados.length }} municípios...
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                Isso pode levar alguns segundos
              </div>
            </v-card>
          </div>

          <template v-else>
            <!-- Estatísticas -->
            <div class="px-4 pt-4">
              <div class="d-flex gap-2 overflow-x-auto pb-1">
                <v-card
                  rounded="lg"
                  elevation="0"
                  class="pa-3 text-center"
                  min-width="90"
                  color="primary"
                  variant="tonal"
                >
                  <div class="text-subtitle-1 font-weight-bold text-primary">
                    {{ formatNumber(stats.total_votos) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Votos
                  </div>
                </v-card>

                <v-card
                  rounded="lg"
                  elevation="0"
                  class="pa-3 text-center"
                  min-width="90"
                  color="secondary"
                  variant="tonal"
                >
                  <div class="text-subtitle-1 font-weight-bold text-secondary">
                    {{ stats.total_candidatos }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Candidatos
                  </div>
                </v-card>

                <v-card
                  rounded="lg"
                  elevation="0"
                  class="pa-3 text-center"
                  min-width="90"
                  color="info"
                  variant="tonal"
                >
                  <div class="text-subtitle-1 font-weight-bold text-info">
                    {{ stats.total_partidos }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Partidos
                  </div>
                </v-card>

                <v-card
                  rounded="lg"
                  elevation="0"
                  class="pa-3 text-center"
                  min-width="90"
                  color="success"
                  variant="tonal"
                >
                  <div class="text-caption font-weight-bold text-success">
                    {{ stats.top_partido }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Top Partido
                  </div>
                </v-card>
              </div>
            </div>

            <!-- Lista de candidatos -->
            <div class="px-4 pt-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <span class="text-overline text-medium-emphasis">
                  Top 20 Candidatos
                </span>
              </div>

              <!-- Sem resultados -->
              <v-card v-if="topCandidatos.length === 0" rounded="lg" elevation="0" class="pa-6 text-center">
                <v-icon size="48" color="grey" class="mb-2">
                  mdi-account-search-outline
                </v-icon>
                <div class="text-body-1 text-medium-emphasis">
                  Nenhum candidato encontrado para os filtros selecionados.
                </div>
                <v-btn
                  color="primary"
                  variant="text"
                  class="mt-2"
                  @click="cargoSelecionado = null; iniciarConsulta()"
                >
                  Limpar filtro de cargo
                </v-btn>
              </v-card>

              <!-- Lista -->
              <v-card v-else rounded="lg" elevation="0">
                <v-list lines="three" class="py-0">
                  <template v-for="(candidato, index) in topCandidatos" :key="`${candidato.nm_candidato}-${candidato.sg_partido}`">
                    <CandidatoCard
                      :candidato="candidato"
                      :rank="index + 1"
                      :show-ano="false"
                      :show-municipios="true"
                      variant="list"
                    />

                    <v-divider v-if="index < topCandidatos.length - 1" />
                  </template>
                </v-list>
              </v-card>
            </div>
          </template>
        </template>

        <!-- Dica inicial (antes da consulta) -->
        <div v-if="!consultaIniciada" class="px-4 pt-4">
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
          >
            <div class="text-body-2">
              <strong>Dica:</strong> Remova municípios clicando no <v-icon size="14">
                mdi-close
              </v-icon>
              para focar em cidades específicas, ou consulte todos de uma vez.
            </div>
          </v-alert>
        </div>
      </template>
    </div>
  </div>
</template>
