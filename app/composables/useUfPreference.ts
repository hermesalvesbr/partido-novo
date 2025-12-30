import type { Estado } from '~/data/eleicoes'
import { ESTADOS } from '~/data/eleicoes'

/**
 * Composable para gerenciar a preferência de UF do usuário
 *
 * Prioridade:
 * 1. Cookie/localStorage (escolha manual do usuário)
 * 2. Geolocalização (detecção automática)
 *
 * Usa useCookie (Nuxt 4 best practice) para persistência SSR-friendly
 */
export function useUfPreference() {
  // Cookie para persistir a preferência do usuário (SSR-friendly)
  const ufCookie = useCookie<Estado | null>('uf-preference', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    sameSite: 'lax',
  })

  // Geolocalização
  const { estadoDetectado, loading: geoLoading } = useGeolocalizacao()

  // Flag para saber se o usuário já fez uma escolha manual
  const hasUserPreference = computed(() => ufCookie.value !== null)

  // UF efetivo: prioridade para cookie, fallback para geolocalização
  const ufEfetivo = computed<Estado | null>(() => {
    // Prioridade 1: Preferência do usuário (cookie)
    if (ufCookie.value !== null) {
      return ufCookie.value
    }

    // Prioridade 2: Geolocalização
    return estadoDetectado.value
  })

  /**
   * Salva a preferência de UF do usuário
   * Chamado quando o usuário seleciona manualmente um estado
   */
  function saveUfPreference(uf: Estado | null): void {
    ufCookie.value = uf
  }

  /**
   * Limpa a preferência do usuário (volta a usar geolocalização)
   */
  function clearUfPreference(): void {
    ufCookie.value = null
  }

  /**
   * Verifica se é um estado válido
   */
  function isValidEstado(code: string | null | undefined): code is Estado {
    if (!code)
      return false
    return (ESTADOS as readonly string[]).includes(code)
  }

  return {
    // Estado
    ufPreference: ufCookie,
    ufEfetivo: readonly(ufEfetivo),
    hasUserPreference: readonly(hasUserPreference),
    estadoDetectado: readonly(estadoDetectado),
    geoLoading: readonly(geoLoading),

    // Métodos
    saveUfPreference,
    clearUfPreference,
    isValidEstado,
  }
}
