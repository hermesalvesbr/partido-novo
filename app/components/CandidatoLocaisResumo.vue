<script setup lang="ts">
import { tituloLocal } from '~/utils/locais'

/**
 * Top 5 escolas do candidato na eleição, com link para /candidato/[slug]/locais.
 * Só é montado quando o ano tem dados por local (ANOS_COM_LOCAIS).
 */
const props = defineProps<{
  slug: string
  ano: number
}>()

const { data, status } = useCandidatoLocais(toRef(props, 'slug'), toRef(props, 'ano'), { server: false })

const top = computed(() => (data.value?.locais ?? []).slice(0, 5))
const maxVotos = computed(() => top.value[0]?.votos ?? 1)
const link = computed(() => ({ path: `/candidato/${props.slug}/locais`, query: { ano: String(props.ano) } }))
</script>

<template>
  <div v-if="status === 'pending' || data?.disponivel" class="px-4 pb-4">
    <p class="text-overline text-medium-emphasis mb-2">
      <v-icon size="16" class="mr-1">
        mdi-school-outline
      </v-icon>
      Escolas com mais votos em {{ ano }}
    </p>

    <v-card v-if="status === 'pending'" variant="outlined" rounded="lg">
      <v-card-text class="pa-4">
        <v-skeleton-loader type="list-item-two-line, list-item-two-line, list-item-two-line" />
      </v-card-text>
    </v-card>

    <v-card v-else-if="data" variant="flat" rounded="lg" class="overflow-hidden">
      <v-list density="compact" class="py-0">
        <template v-for="(local, index) in top" :key="local.id">
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
              {{ tituloLocal(local.local) }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              {{ local.bairro }} · {{ local.municipio }}
            </v-list-item-subtitle>
            <v-progress-linear
              :model-value="(local.votos / maxVotos) * 100"
              color="primary"
              height="6"
              rounded
              class="mt-1"
            />

            <template #append>
              <div class="text-right ml-3">
                <p class="text-body-2 font-weight-bold mb-0">
                  {{ local.votos.toLocaleString('pt-BR') }}
                </p>
                <p class="text-caption text-medium-emphasis mb-0">
                  {{ local.pctLocal.toFixed(1) }}% no local
                </p>
              </div>
            </template>
          </v-list-item>
          <v-divider v-if="index < top.length - 1" />
        </template>
      </v-list>

      <v-divider />
      <v-card-actions class="justify-center py-2">
        <v-btn
          variant="text"
          size="small"
          color="primary"
          :to="link"
          append-icon="mdi-chevron-right"
        >
          Mapa, bairros e regiões ({{ data.locais.length.toLocaleString('pt-BR') }} escolas)
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>
