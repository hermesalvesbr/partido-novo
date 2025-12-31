import type { Estado } from '~/data/eleicoes'

/**
 * Interface para candidato trending (dados completos para CandidatoCard)
 */
export interface TrendingCandidato {
  slug: string
  nome: string
  nomeCompleto: string
  partido: string
  cargo: string
  anoEleicao: number
  situacao: string
  totalVotos: number
  acessos: number
}

/**
 * Composable para buscar e rastrear candidatos trending por UF
 *
 * Funcionalidades:
 * - Busca top 3 candidatos mais acessados da UF
 * - Rastreia acessos a páginas de candidatos (fire-and-forget)
 */
export function useTrendingCandidatos() {
  /**
   * Buscar candidatos trending da UF
   * Usa useAsyncData para cache e SSR
   */
  function useTrending(uf: Ref<Estado | null>) {
    // Estado reativo local
    const trending = ref<TrendingCandidato[]>([])
    const loading = ref(false)

    // Buscar trending quando UF mudar
    async function fetchTrending() {
      if (!uf.value) {
        trending.value = []
        return
      }

      loading.value = true
      try {
        trending.value = await $fetch<TrendingCandidato[]>(`/api/trending/${uf.value}`)
      }
      catch {
        trending.value = []
      }
      finally {
        loading.value = false
      }
    }

    // Watch para reagir a mudanças no UF
    watch(uf, () => {
      fetchTrending()
    }, { immediate: true })

    const hasTrending = computed(() => trending.value.length > 0)

    return {
      trending: readonly(trending),
      loading: readonly(loading),
      hasTrending,
      refresh: fetchTrending,
    }
  }

  /**
   * Rastrear acesso a um candidato (fire-and-forget)
   * Chamado quando o usuário acessa a página de um candidato
   */
  async function trackAccess(params: {
    slug: string
    uf: string
    nome: string
    nomeCompleto: string
    partido: string
    cargo: string
    anoEleicao: number
    situacao: string
    totalVotos: number
  }): Promise<void> {
    // Fire-and-forget: não espera resposta, não bloqueia UI
    try {
      await $fetch('/api/trending/track', {
        method: 'POST',
        body: params,
      })
    }
    catch {
      // Silencioso - não afeta experiência do usuário
    }
  }

  return {
    useTrending,
    trackAccess,
  }
}
