import type { CandidatoBusca } from './useCandidatoSearch'
import type { Estado } from '~/data/eleicoes'
import { watchDebounced } from '@vueuse/core'

/**
 * Chave para cache de sugestões: `{uf}:{termo}`
 */
type CacheKey = string

/**
 * Cache de sugestões em memória (persiste durante a sessão)
 */
interface TypeaheadCache {
  [key: CacheKey]: CandidatoBusca[]
}

/**
 * Composable para busca typeahead de candidatos
 *
 * Responsabilidades:
 * - Debounce de 250ms na digitação
 * - Cache em memória por prefixo+UF
 * - Chamada ao endpoint /api/search/suggestions
 * - Retorna sugestões compatíveis com CandidatoCard
 *
 * NÃO mistura com lógica de busca por cidade (separação de responsabilidades)
 */
export function useCandidatoTypeahead() {
  // Cache em memória usando useState (persiste entre navegações)
  const cache = useState<TypeaheadCache>('typeahead-cache', () => ({}))

  // Estado do typeahead
  const inputValue = ref('')
  const suggestions = ref<CandidatoBusca[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // UF atual para filtrar sugestões (opcional)
  const currentUf = ref<Estado | null>(null)

  /**
   * Gera chave de cache: `{uf}:{termo_normalizado}`
   */
  function getCacheKey(termo: string, uf: Estado | null): CacheKey {
    const normalizedTerm = termo.toLowerCase().trim()
    return uf ? `${uf}:${normalizedTerm}` : `all:${normalizedTerm}`
  }

  /**
   * Busca sugestões no endpoint cacheado
   */
  async function fetchSuggestions(termo: string): Promise<void> {
    const trimmed = termo.trim()

    // Mínimo 3 caracteres para buscar
    if (trimmed.length < 3) {
      suggestions.value = []
      return
    }

    const cacheKey = getCacheKey(trimmed, currentUf.value)

    // Verifica cache em memória primeiro
    if (cache.value[cacheKey]) {
      suggestions.value = cache.value[cacheKey]
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      params.set('termo', trimmed)
      if (currentUf.value) {
        params.set('uf', currentUf.value)
      }

      const data = await $fetch<CandidatoBusca[]>(`/api/search/suggestions?${params.toString()}`)

      // Armazena no cache
      cache.value[cacheKey] = data

      // Atualiza sugestões apenas se o termo ainda for o mesmo
      if (inputValue.value.trim() === trimmed) {
        suggestions.value = data
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Erro ao buscar sugestões'
      suggestions.value = []
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Limpa sugestões e cache
   */
  function clearSuggestions(): void {
    suggestions.value = []
    inputValue.value = ''
  }

  /**
   * Define a UF para filtrar sugestões
   */
  function setUf(uf: Estado | null): void {
    currentUf.value = uf
    // Limpa sugestões ao mudar UF (cache é por UF)
    suggestions.value = []
  }

  // Watch com debounce de 250ms
  watchDebounced(
    inputValue,
    (value) => {
      fetchSuggestions(value)
    },
    { debounce: 250, maxWait: 1000 },
  )

  // Limpa sugestões quando UF muda
  watch(currentUf, () => {
    if (inputValue.value.trim().length >= 3) {
      // Refaz a busca com nova UF
      fetchSuggestions(inputValue.value)
    }
  })

  return {
    // Estado
    inputValue,
    suggestions,
    isLoading,
    error,
    currentUf,

    // Ações
    clearSuggestions,
    setUf,
    fetchSuggestions,
  }
}
