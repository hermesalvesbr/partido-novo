import type { AnoEleicao, Estado } from '~/data/eleicoes'

import { PostgrestClient } from '@supabase/postgrest-js'

/**
 * Composable para carregar lista de cidades por UF e ano
 * Usado para filtros de eleições municipais
 */
export function useCidadesFilter() {
  // Runtime config para URL da API
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string
  const client = new PostgrestClient(apiUrl)

  // Estado reativo
  const cidades = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Carrega cidades de um estado para um ano específico
   */
  async function loadCidades(uf: Estado, ano: AnoEleicao): Promise<void> {
    // Só carrega para eleições municipais
    if (ano !== 2020 && ano !== 2024) {
      cidades.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const { data } = await client
        .from('votacao_candidato_munzona')
        .select('nm_municipio')
        .eq('sg_uf', uf)
        .eq('ano_eleicao', ano)
        .order('nm_municipio')

      // Remove duplicatas
      const uniqueCidades = [...new Set((data || []).map((d: { nm_municipio: string }) => d.nm_municipio))]
      cidades.value = uniqueCidades.filter(Boolean) as string[]
    }
    catch (e) {
      console.error('Erro ao carregar cidades:', e)
      error.value = 'Erro ao carregar cidades'
      cidades.value = []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Limpa a lista de cidades
   */
  function clearCidades(): void {
    cidades.value = []
    error.value = null
  }

  return {
    cidades: readonly(cidades),
    loading: readonly(loading),
    error: readonly(error),
    loadCidades,
    clearCidades,
  }
}
