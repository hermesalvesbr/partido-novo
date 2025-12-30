<script setup lang="ts">
import { formatNumber, formatSituacao, getSituacaoColor } from '~/utils/formatters'
import { getPartidoLogoUrl } from '~/utils/partido'
import { generateCandidatoSlug } from '~/utils/slug'

const props = withDefaults(defineProps<{
  candidato: CandidatoCardData
  /** Posição no ranking (se fornecido, mostra numeração) */
  rank?: number
  /** Mostra ano da eleição */
  showAno?: boolean
  /** Mostra contagem de municípios (se disponível) */
  showMunicipios?: boolean
  /** Variante visual: 'card' para cards soltos, 'list' para dentro de v-list */
  variant?: 'card' | 'list'
}>(), {
  rank: undefined,
  showAno: true,
  showMunicipios: false,
  variant: 'card',
})

// Composable para passar dados do candidato para a página de detalhes
const { setCandidato } = useCandidatoSelecionado()

// Interface flexível para candidato (suporta ambos os formatos)
export interface CandidatoCardData {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  sg_uf: string
  ds_sit_tot_turno: string
  ano_eleicao?: number
  nm_municipio?: string
  // Suporta ambos os nomes de campo para votos
  qt_votos_nominais?: number
  total_votos?: number
  // Dados extras para modo ranking
  municipios_votados?: string[]
}

// Estado para controlar fallback quando imagem não carrega
const imageError = ref(false)

// Computed: Total de votos (suporta ambos os campos)
const totalVotos = computed(() =>
  props.candidato.total_votos ?? props.candidato.qt_votos_nominais ?? 0,
)

// Computed: Situação formatada
const situacaoFormatada = computed(() => formatSituacao(props.candidato.ds_sit_tot_turno))

// Computed: URL do logo do partido
const logoUrl = computed(() => getPartidoLogoUrl(props.candidato.sg_partido))

// Computed: Devemos mostrar a imagem?
const showImage = computed(() => logoUrl.value && !imageError.value)

// Computed: Quantidade de municípios
const municipiosCount = computed(() => props.candidato.municipios_votados?.length ?? 0)

// Handler para erro ao carregar imagem
function handleImageError() {
  imageError.value = true
}

// Reset imageError quando mudar o partido
watch(() => props.candidato.sg_partido, () => {
  imageError.value = false
})

// Navegar para página do candidato usando nome completo (garante unicidade)
function navigateToCandidato(): void {
  // Salva os dados do candidato no estado compartilhado para evitar busca desnecessária
  setCandidato({
    nm_candidato: props.candidato.nm_candidato,
    nm_urna_candidato: props.candidato.nm_urna_candidato,
    sg_uf: props.candidato.sg_uf,
    sg_partido: props.candidato.sg_partido,
    ds_cargo: props.candidato.ds_cargo,
    ano_eleicao: props.candidato.ano_eleicao,
  })

  const slug = generateCandidatoSlug(props.candidato.sg_uf, props.candidato.nm_candidato)
  navigateTo(`/candidato/${slug}`)
}
</script>

<template>
  <!-- Variante Card (usado em index.vue) -->
  <v-card
    v-if="variant === 'card'"
    variant="flat"
    rounded="lg"
    class="cursor-pointer"
    @click="navigateToCandidato"
  >
    <v-card-text class="d-flex align-center ga-3 pa-3">
      <!-- Ranking (opcional) -->
      <div
        v-if="rank !== undefined"
        class="text-caption font-weight-bold text-medium-emphasis flex-shrink-0"
        style="width: 24px; text-align: right;"
      >
        {{ rank }}º
      </div>

      <!-- Logo do partido ou chip com sigla -->
      <NuxtImg
        v-if="showImage"
        :src="logoUrl!"
        :alt="candidato.sg_partido"
        preset="partido"
        class="flex-shrink-0"
        style="width: 48px; height: 48px; object-fit: contain;"
        loading="lazy"
        @error="handleImageError"
      />
      <v-chip v-else color="primary" variant="tonal" class="flex-shrink-0 font-weight-bold">
        {{ candidato.sg_partido }}
      </v-chip>

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
        <p v-if="showMunicipios && municipiosCount > 0" class="text-caption text-medium-emphasis mb-0">
          {{ municipiosCount }} município(s)
        </p>
      </div>

      <!-- Votos e situação -->
      <div class="text-right flex-shrink-0">
        <v-chip
          v-if="situacaoFormatada"
          :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
          size="x-small"
          class="mb-1"
        >
          {{ situacaoFormatada }}
        </v-chip>
        <p class="text-body-2 font-weight-bold mb-0">
          {{ formatNumber(totalVotos) }} votos
        </p>
        <p v-if="showAno && candidato.ano_eleicao" class="text-caption text-medium-emphasis mb-0">
          {{ candidato.ano_eleicao }}
        </p>
      </div>
    </v-card-text>
  </v-card>

  <!-- Variante List-Item (usado em regioes/[id].vue) -->
  <v-list-item
    v-else
    class="px-3 py-2"
    @click="navigateToCandidato"
  >
    <template #prepend>
      <div class="d-flex align-center mr-2">
        <!-- Ranking -->
        <div
          v-if="rank !== undefined"
          class="text-caption font-weight-bold text-medium-emphasis mr-2"
          style="width: 24px; text-align: right;"
        >
          {{ rank }}º
        </div>
        <!-- Logo do partido ou chip com sigla -->
        <NuxtImg
          v-if="showImage"
          :src="logoUrl!"
          :alt="candidato.sg_partido"
          preset="partidoSmall"
          class="flex-shrink-0"
          style="width: 40px; height: 40px; object-fit: contain;"
          loading="lazy"
          @error="handleImageError"
        />
        <v-chip v-else size="small" color="primary" variant="tonal" class="flex-shrink-0 font-weight-bold">
          {{ candidato.sg_partido }}
        </v-chip>
      </div>
    </template>

    <v-list-item-title class="font-weight-medium text-body-2">
      {{ candidato.nm_urna_candidato || candidato.nm_candidato }}
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
          v-if="situacaoFormatada"
          size="x-small"
          variant="tonal"
          :color="getSituacaoColor(candidato.ds_sit_tot_turno)"
        >
          {{ situacaoFormatada }}
        </v-chip>
      </div>
      <div v-if="showMunicipios && municipiosCount > 0" class="mt-1 text-caption text-medium-emphasis">
        {{ municipiosCount }} município(s)
      </div>
    </v-list-item-subtitle>

    <template #append>
      <div class="text-right">
        <div class="text-subtitle-2 font-weight-bold text-primary">
          {{ formatNumber(totalVotos) }}
        </div>
        <div class="text-caption text-medium-emphasis">
          votos
        </div>
      </div>
    </template>
  </v-list-item>
</template>
