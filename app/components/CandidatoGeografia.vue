<script setup lang="ts">
import { formatNumber } from '~/utils/formatters'

interface MunicipioVotos {
  nm_municipio: string
  total_votos: number
  percentual: number
}

const props = defineProps<{
  municipios: MunicipioVotos[]
  totalVotos: number
}>()

// Estado de carregamento interno para transição suave
const isReady = ref(false)

// Mostrar apenas top 10 inicialmente
const showAll = ref(false)
const displayLimit = 10

const municipiosExibidos = computed(() => {
  if (showAll.value || props.municipios.length <= displayLimit) {
    return props.municipios
  }
  return props.municipios.slice(0, displayLimit)
})

const hasMore = computed(() => props.municipios.length > displayLimit)

// Percentual máximo para calcular a barra de progresso
const maxPercentual = computed(() => {
  if (props.municipios.length === 0)
    return 100
  return props.municipios[0]?.percentual ?? 100
})

// Renderização lazy: aguardar próximo tick para não bloquear UI
onMounted(() => {
  // Usar requestIdleCallback para renderizar quando browser estiver idle
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      isReady.value = true
    })
  }
  else {
    // Fallback para browsers sem suporte
    setTimeout(() => {
      isReady.value = true
    }, 50)
  }
})
</script>

<template>
  <div class="px-4 pb-4">
    <p class="text-overline text-medium-emphasis mb-2">
      <v-icon size="16" class="mr-1">
        mdi-map-marker-multiple
      </v-icon>
      Distribuição Geográfica de Votos
    </p>

    <!-- Skeleton loader enquanto não está pronto -->
    <v-card v-if="!isReady" variant="outlined" rounded="lg">
      <v-card-text class="pa-4">
        <v-skeleton-loader type="list-item-avatar, list-item-avatar, list-item-avatar" />
      </v-card-text>
    </v-card>

    <v-card v-else-if="municipios.length === 0" variant="outlined" rounded="lg">
      <v-card-text class="text-center text-medium-emphasis py-6">
        <v-icon size="32" class="mb-2">
          mdi-map-marker-off
        </v-icon>
        <p class="mb-0">
          Sem dados de municípios disponíveis
        </p>
      </v-card-text>
    </v-card>

    <v-card v-else variant="flat" rounded="lg" class="overflow-hidden">
      <!-- Header -->
      <v-card-text class="pb-2 pt-3 px-4 bg-grey-lighten-4">
        <div class="d-flex justify-space-between align-center">
          <span class="text-body-2 font-weight-medium">
            Top Municípios
          </span>
          <v-chip size="x-small" variant="tonal" color="primary">
            {{ municipios.length }} cidades
          </v-chip>
        </div>
      </v-card-text>

      <v-divider />

      <!-- Lista de municípios -->
      <v-list density="compact" class="py-0">
        <template v-for="(mun, index) in municipiosExibidos" :key="mun.nm_municipio">
          <v-list-item class="px-4 py-2">
            <template #prepend>
              <v-avatar
                :color="index < 3 ? 'primary' : 'grey-lighten-2'"
                :variant="index < 3 ? 'flat' : 'tonal'"
                size="28"
                class="mr-3"
              >
                <span class="text-caption font-weight-bold" :class="index < 3 ? 'text-white' : ''">
                  {{ index + 1 }}
                </span>
              </v-avatar>
            </template>

            <v-list-item-title class="text-body-2">
              {{ mun.nm_municipio }}
            </v-list-item-title>

            <v-list-item-subtitle class="mt-1">
              <v-progress-linear
                :model-value="(mun.percentual / maxPercentual) * 100"
                color="primary"
                height="6"
                rounded
                class="mb-1"
              />
            </v-list-item-subtitle>

            <template #append>
              <div class="text-right">
                <p class="text-body-2 font-weight-bold mb-0">
                  {{ formatNumber(mun.total_votos) }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  {{ mun.percentual.toFixed(1) }}%
                </p>
              </div>
            </template>
          </v-list-item>

          <v-divider v-if="index < municipiosExibidos.length - 1" />
        </template>
      </v-list>

      <!-- Botão ver mais -->
      <template v-if="hasMore">
        <v-divider />
        <v-card-actions class="justify-center py-2">
          <v-btn
            variant="text"
            size="small"
            color="primary"
            @click="showAll = !showAll"
          >
            <v-icon start size="18">
              {{ showAll ? 'mdi-chevron-up' : 'mdi-chevron-down' }}
            </v-icon>
            {{ showAll ? 'Ver menos' : `Ver mais ${municipios.length - displayLimit} cidades` }}
          </v-btn>
        </v-card-actions>
      </template>
    </v-card>

    <!-- Info adicional -->
    <v-card rounded="lg" elevation="0" class="mt-3 pa-3" color="grey-lighten-3">
      <div class="d-flex align-center">
        <v-icon color="info" size="18" class="mr-2">
          mdi-information-outline
        </v-icon>
        <span class="text-caption text-medium-emphasis">
          Ranking baseado no total de votos recebidos em cada município ao longo de todas as eleições.
        </span>
      </div>
    </v-card>
  </div>
</template>
