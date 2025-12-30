import type { Estado } from '~/data/eleicoes'

// Tipo para o cache de cidades por UF (cache local para evitar fetch repetido)
type CidadesCache = Partial<Record<Estado, string[]>>

/**
 * Composable para carregar lista de cidades por UF
 * Usa API /api/cidades/[uf] com cache no servidor (defineCachedEventHandler)
 * Também mantém cache local com useState para evitar fetch repetido na mesma sessão
 */
export function useCidadesFilter() {
  // Loading indicator global do Nuxt
  const loadingIndicator = useLoadingIndicator()

  // Cache local por UF (evita fetch repetido na mesma sessão)
  const cidadesCache = useState<CidadesCache>('cidades-cache', () => ({}))

  // Estado reativo para cidades do UF atual
  const cidades = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Carrega cidades de um estado
   * 1. Verifica cache local (instantâneo)
   * 2. Se não tem, busca da API (cache no servidor)
   */
  async function loadCidades(uf: Estado): Promise<void> {
    // Verifica cache local primeiro
    const cached = cidadesCache.value[uf]
    if (cached && cached.length > 0) {
      cidades.value = cached
      return
    }

    loading.value = true
    error.value = null
    loadingIndicator.start()

    try {
      // Busca da API com cache no servidor
      const data = await $fetch<string[]>(`/api/cidades/${uf}`)

      // Salva no cache local
      cidadesCache.value = {
        ...cidadesCache.value,
        [uf]: data,
      }

      cidades.value = data
    }
    catch (e) {
      console.error('Erro ao carregar cidades:', e)
      error.value = 'Erro ao carregar cidades'
      cidades.value = []
    }
    finally {
      loading.value = false
      loadingIndicator.finish()
    }
  }

  /**
   * Limpa a lista de cidades atual (não limpa o cache)
   */
  function clearCidades(): void {
    cidades.value = []
    error.value = null
  }

  /**
   * Limpa todo o cache local (útil para refresh forçado)
   */
  function clearCache(): void {
    cidadesCache.value = {}
  }

  return {
    cidades: readonly(cidades),
    loading: readonly(loading),
    error: readonly(error),
    loadCidades,
    clearCidades,
    clearCache,
  }
}
