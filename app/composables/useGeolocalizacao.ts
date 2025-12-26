import type { Estado } from '~/data/eleicoes'
import { ESTADOS } from '~/data/eleicoes'

export interface GeoData {
  city: string | null
  region: string | null
  regionCode: string | null
  country: string | null
  countryCode: string | null
  ip: string
  error?: string
}

// Helper para verificar se é um estado válido
function isValidEstado(code: string | null | undefined): code is Estado {
  if (!code)
    return false
  return (ESTADOS as readonly string[]).includes(code)
}

/**
 * Composable para geolocalização do usuário via IP
 * Detecta automaticamente o estado brasileiro do usuário
 */
export function useGeolocalizacao() {
  // Estado reativo para armazenar dados
  const geoData = ref<GeoData | null>(null)
  const loading = ref(true)
  const hasError = ref(false)

  // Estado detectado (validado contra lista de estados)
  const estadoDetectado = computed<Estado | null>(() => {
    const regionCode = geoData.value?.regionCode
    if (isValidEstado(regionCode)) {
      return regionCode
    }
    return null
  })

  // Cidade detectada
  const cidadeDetectada = computed(() => geoData.value?.city ?? null)

  // Buscar geolocalização ao montar
  onMounted(async () => {
    try {
      const data = await $fetch<GeoData>('/api/geo')
      geoData.value = data
      hasError.value = !!data.error
    }
    catch (e) {
      console.error('Erro ao buscar geolocalização:', e)
      hasError.value = true
    }
    finally {
      loading.value = false
    }
  })

  return {
    geoData: readonly(geoData),
    estadoDetectado,
    cidadeDetectada,
    loading: readonly(loading),
    hasError: readonly(hasError),
  }
}
