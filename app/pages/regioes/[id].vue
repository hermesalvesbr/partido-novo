<script setup lang="ts">
import type { MunicipioIBGE } from '~/composables/useMesorregiao'
import type { AnoEleicao } from '~/data/eleicoes'
import { ANOS_ELEICAO } from '~/data/eleicoes'
import { formatNumber, getSituacaoColor } from '~/utils/formatters'
import { getPartidoLogoUrl } from '~/utils/partido'
import { generateCandidatoSlugFromUrna } from '~/utils/slug'

// Pegar ID da mesorregião da rota
const route = useRoute()
const mesorregiaoId = computed(() => {
  const id = route.params.id
  return id ? Number(id) : null
})

// Buscar dados da mesorregião e municípios (rápido - IBGE)
const { mesorregiao, municipios, loading: loadingMeso } = useMesorregiao(mesorregiaoId)

// Título da página
useHead({
  title: computed(() => mesorregiao.value?.nome ?? 'Região'),
})

// UF da mesorregião
const uf = computed(() => mesorregiao.value?.UF?.sigla ?? null)

// ===== ESTADO LOCAL =====
// Municípios selecionados para consulta (inicialmente todos)
const municipiosSelecionados = ref<MunicipioIBGE[]>([])

// Filtros
const anoSelecionado = ref<AnoEleicao>(2024)
const cargoSelecionado = ref<string | null>(null)

// Controle de consulta
const consultaIniciada = ref(false)
const consultando = ref(false)

// Inicializar municípios selecionados quando carregar
watch(municipios, (novos) => {
  if (novos && novos.length > 0 && municipiosSelecionados.value.length === 0) {
    municipiosSelecionados.value = [...novos]
  }
}, { immediate: true })

// Nomes dos municípios selecionados
const nomesMunicipiosSelecionados = computed(() =>
  municipiosSelecionados.value.map(m => m.nome.toUpperCase()),
)

// Cargos disponíveis baseado no ano
const cargosDisponiveis = computed(() => {
  const ano = anoSelecionado.value
  if (ano === 2020 || ano === 2024) {
    return ['Prefeito', 'Vereador']
  }
  return ['Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual']
})

// Composable para buscar candidatos (não busca automaticamente)
const { candidatos, stats, loading: loadingCandidatos, refresh } = useCandidatosRegiao(
  nomesMunicipiosSelecionados,
  uf,
  anoSelecionado,
  cargoSelecionado,
)

// Remover município da seleção
function removerMunicipio(mun: MunicipioIBGE): void {
  municipiosSelecionados.value = municipiosSelecionados.value.filter(m => m.id !== mun.id)
}

// Restaurar todos os municípios
function restaurarTodos(): void {
  if (municipios.value) {
    municipiosSelecionados.value = [...municipios.value]
  }
}

// Iniciar consulta
async function iniciarConsulta(): Promise<void> {
  if (municipiosSelecionados.value.length === 0)
    return

  consultando.value = true
  consultaIniciada.value = true

  try {
    await refresh()
  }
  finally {
    consultando.value = false
  }
}

// Top 20 candidatos para exibição
const topCandidatos = computed(() => candidatos.value.slice(0, 20))

// Navegar para candidato
function goToCandidato(candidato: { sg_uf: string, nm_urna_candidato: string }): void {
  const slug = generateCandidatoSlugFromUrna(candidato.sg_uf, candidato.nm_urna_candidato)
  navigateTo(`/candidato/${slug}`)
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div class="flex-grow-1 overflow-y-auto bg-grey-lighten-4 pb-4">
      <!-- Header com info da região -->
      <v-card flat class="rounded-0 pa-4" color="primary">
        <div class="d-flex align-center">
          <v-btn
            icon
            variant="text"
            color="white"
            size="small"
            class="mr-2"
            @click="navigateTo('/regioes')"
          >
            <v-icon>mdi-arrow-left</v-icon>
          </v-btn>
          <div class="flex-grow-1">
            <h1 class="text-h6 text-white font-weight-bold">
              {{ mesorregiao?.nome ?? 'Carregando...' }}
            </h1>
            <div v-if="mesorregiao" class="d-flex align-center gap-2 mt-1">
              <v-chip color="white" variant="flat" size="x-small">
                {{ mesorregiao.UF?.sigla }}
              </v-chip>
              <span class="text-white text-caption">
                {{ municipios?.length ?? 0 }} municípios
              </span>
            </div>
          </div>
        </div>
      </v-card>

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
                  @click="restaurarTodos"
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
                    <v-list-item
                      class="px-3 py-2"
                      @click="goToCandidato(candidato)"
                    >
                      <template #prepend>
                        <div class="d-flex align-center mr-2">
                          <div
                            class="text-caption font-weight-bold text-medium-emphasis mr-2"
                            style="width: 24px; text-align: right;"
                          >
                            {{ index + 1 }}º
                          </div>
                          <v-avatar size="40" rounded="lg">
                            <v-img
                              :src="getPartidoLogoUrl(candidato.sg_partido) ?? undefined"
                              :alt="candidato.sg_partido"
                            >
                              <template #error>
                                <div class="d-flex align-center justify-center fill-height bg-grey-lighten-2">
                                  <span class="text-caption font-weight-bold">{{ candidato.sg_partido.slice(0, 2) }}</span>
                                </div>
                              </template>
                            </v-img>
                          </v-avatar>
                        </div>
                      </template>

                      <v-list-item-title class="font-weight-medium text-body-2">
                        {{ candidato.nm_urna_candidato }}
                      </v-list-item-title>

                      <v-list-item-subtitle class="text-caption">
                        <div class="d-flex flex-wrap align-center gap-1 mt-1">
                          <v-chip size="x-small" variant="tonal" color="primary">
                            {{ candidato.sg_partido }}
                          </v-chip>
                          <v-chip size="x-small" variant="text">
                            {{ candidato.ds_cargo }}
                          </v-chip>
                          <v-chip
                            size="x-small"
                            variant="tonal"
                            :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
                          >
                            {{ candidato.ds_sit_tot_turno }}
                          </v-chip>
                        </div>
                        <div class="mt-1 text-caption text-medium-emphasis">
                          {{ candidato.municipios_votados.length }} município(s)
                        </div>
                      </v-list-item-subtitle>

                      <template #append>
                        <div class="text-right">
                          <div class="text-subtitle-2 font-weight-bold text-primary">
                            {{ formatNumber(candidato.total_votos) }}
                          </div>
                          <div class="text-caption text-medium-emphasis">
                            votos
                          </div>
                        </div>
                      </template>
                    </v-list-item>

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
