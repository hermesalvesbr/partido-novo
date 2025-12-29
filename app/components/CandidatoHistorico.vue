<script setup lang="ts">
import { formatNumber, formatSituacao, getSituacaoColor } from '~/utils/formatters'

interface Eleicao {
  ano_eleicao: number
  ds_cargo: string
  sg_partido: string
  nr_turno: number
  ds_sit_tot_turno: string
  total_votos: number
  municipios_count: number
}

defineProps<{
  eleicoes: Eleicao[]
}>()

// Estado de carregamento interno para transição suave (padrão CandidatoGeografia)
const isReady = ref(false)

// Renderização lazy: aguardar próximo tick para não bloquear UI
onMounted(() => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      isReady.value = true
    })
  }
  else {
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
        mdi-vote
      </v-icon>
      Histórico de Eleições
    </p>

    <!-- Skeleton loader enquanto não está pronto -->
    <v-card v-if="!isReady" variant="outlined" rounded="lg">
      <v-card-text class="pa-4">
        <v-skeleton-loader type="list-item-two-line, list-item-two-line, list-item-two-line" />
      </v-card-text>
    </v-card>

    <!-- Sem eleições -->
    <v-card v-else-if="eleicoes.length === 0" variant="outlined" rounded="lg">
      <v-card-text class="text-center text-medium-emphasis py-6">
        <v-icon size="32" class="mb-2">
          mdi-calendar-remove
        </v-icon>
        <p class="mb-0">
          Nenhum histórico de eleições disponível
        </p>
      </v-card-text>
    </v-card>

    <!-- Timeline de eleições -->
    <v-timeline v-else side="end" density="compact">
      <v-timeline-item
        v-for="eleicao in eleicoes"
        :key="`${eleicao.ano_eleicao}-${eleicao.ds_cargo}-${eleicao.nr_turno}`"
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
</template>
