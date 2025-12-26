<script setup lang="ts">
import type { Estado } from '~/data/eleicoes'
import { ESTADOS } from '~/data/eleicoes'

useSeoMeta({
  title: 'Mesorregiões',
  description: 'Explore as mesorregiões geográficas do IBGE por estado. Consulte municípios, candidatos e dados eleitorais por região.',
  ogTitle: 'Mesorregiões | NOVO Pernambuco',
  ogDescription: 'Explore as mesorregiões geográficas do IBGE por estado. Consulte candidatos e dados eleitorais por região.',
  twitterTitle: 'Mesorregiões | NOVO Pernambuco',
  twitterDescription: 'Explore as mesorregiões geográficas do IBGE por estado. Consulte candidatos e dados eleitorais por região.',
})

// Composables
const { estadoSelecionado, setEstado } = useEstadoSelecionado()
const { estadoDetectado } = useGeolocalizacao()

// Estado local para seletor (reativo para useAsyncData)
const ufLocal = ref<Estado | null>(estadoSelecionado.value)

// useRegioes com ref reativa para cache eficiente via useAsyncData
const { mesorregioes, loading, error } = useRegioes(ufLocal)

// Auto-preencher UF baseado na geolocalização se não houver estado selecionado
watchEffect(() => {
  if (estadoDetectado.value && !estadoSelecionado.value && !ufLocal.value) {
    ufLocal.value = estadoDetectado.value
  }
})

// Sincronizar com estado global quando ufLocal mudar
watch(ufLocal, (novoUf) => {
  setEstado(novoUf)
})

// Nome do estado selecionado
const nomeEstado = computed(() => {
  if (!ufLocal.value)
    return null
  const regiao = mesorregioes.value?.[0]?.UF
  return regiao?.nome ?? ufLocal.value
})
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Header -->
      <v-card flat class="rounded-0 pa-4 pb-2">
        <div class="d-flex align-center mb-3">
          <v-icon color="primary" size="28" class="mr-3">
            mdi-map-marker-radius
          </v-icon>
          <div>
            <h1 class="text-h6 font-weight-bold">
              Mesorregiões
            </h1>
            <p class="text-caption text-medium-emphasis mb-0">
              Regiões geográficas do IBGE
            </p>
          </div>
        </div>

        <!-- Seletor de Estado -->
        <v-select
          v-model="ufLocal"
          :items="ESTADOS"
          label="Selecione o Estado (UF)"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-map"
          clearable
          hide-details
          class="mb-2"
        />
      </v-card>

      <!-- Estado não selecionado -->
      <div v-if="!ufLocal" class="pa-4">
        <v-alert
          type="info"
          variant="tonal"
          prominent
          class="text-center"
        >
          <v-icon size="48" class="mb-2">
            mdi-map-search
          </v-icon>
          <div class="text-h6 mb-1">
            Selecione um Estado
          </div>
          <div class="text-body-2">
            Escolha um estado acima para visualizar suas mesorregiões geográficas.
          </div>
        </v-alert>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="pa-4">
        <v-card rounded="lg" class="pa-8 text-center">
          <v-progress-circular
            indeterminate
            color="primary"
            size="48"
            class="mb-4"
          />
          <div class="text-body-1 text-medium-emphasis">
            Carregando regiões...
          </div>
        </v-card>
      </div>

      <!-- Erro -->
      <div v-else-if="error" class="pa-4">
        <v-alert
          type="error"
          variant="tonal"
          prominent
        >
          <v-icon size="24" class="mr-2">
            mdi-alert-circle
          </v-icon>
          {{ error }}
        </v-alert>
      </div>

      <!-- Lista de Mesorregiões -->
      <div v-else class="pa-4">
        <!-- Info do estado -->
        <div class="d-flex align-center justify-space-between mb-3">
          <div>
            <span class="text-overline text-medium-emphasis">Estado</span>
            <h2 class="text-h6 font-weight-bold">
              {{ nomeEstado }}
            </h2>
          </div>
          <v-chip color="primary" variant="tonal" size="small">
            {{ mesorregioes.length }} regiões
          </v-chip>
        </div>

        <!-- Lista -->
        <v-card rounded="lg" elevation="0">
          <v-list lines="two" class="py-0">
            <template v-for="(regiao, index) in mesorregioes" :key="regiao.id">
              <v-list-item
                class="px-4"
                :to="`/regioes/${regiao.id}`"
              >
                <template #prepend>
                  <v-avatar color="primary" variant="tonal" size="40">
                    <span class="text-body-2 font-weight-bold">{{ index + 1 }}</span>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium">
                  {{ regiao.nome }}
                </v-list-item-title>

                <v-list-item-subtitle>
                  <v-chip size="x-small" variant="outlined" class="mt-1">
                    <v-icon size="12" start>
                      mdi-city
                    </v-icon>
                    {{ regiao.municipiosCount }} municípios
                  </v-chip>
                </v-list-item-subtitle>

                <template #append>
                  <v-icon color="primary" size="20">
                    mdi-chevron-right
                  </v-icon>
                </template>
              </v-list-item>

              <v-divider v-if="index < mesorregioes.length - 1" />
            </template>
          </v-list>
        </v-card>

        <!-- Info adicional -->
        <v-card rounded="lg" elevation="0" class="mt-4 pa-4" color="grey-lighten-3">
          <div class="d-flex align-start">
            <v-icon color="info" size="20" class="mr-3 mt-1">
              mdi-information
            </v-icon>
            <div>
              <p class="text-body-2 text-medium-emphasis mb-0">
                As <strong>mesorregiões</strong> são subdivisões dos estados brasileiros
                definidas pelo IBGE, agrupando municípios com características
                geográficas, sociais e econômicas semelhantes.
              </p>
            </div>
          </div>
        </v-card>
      </div>
    </div>
  </div>
</template>
