import { PostgrestClient } from '@supabase/postgrest-js'

/**
 * API para listar cidades por UF
 * Usa defineCachedEventHandler para cache no servidor (Nitro)
 * Cache de 1 hora (3600 segundos) - cidades raramente mudam
 */
export default defineCachedEventHandler(
  async (event) => {
    const uf = getRouterParam(event, 'uf')

    if (!uf || uf.length !== 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'UF inválido. Deve ter 2 caracteres.',
      })
    }

    const config = useRuntimeConfig()
    const client = new PostgrestClient(config.public.postgrestUrl as string)

    const { data, error } = await client
      .from('votacao_candidato_munzona')
      .select('nm_municipio')
      .eq('sg_uf', uf.toUpperCase())
      .eq('ano_eleicao', 2024)
      .order('nm_municipio')

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: `Erro ao buscar cidades: ${error.message}`,
      })
    }

    // Remove duplicatas e retorna array de strings
    const uniqueCidades = [...new Set((data || []).map((d: { nm_municipio: string }) => d.nm_municipio))]
    return uniqueCidades.filter(Boolean) as string[]
  },
  {
    // Cache por 1 hora (cidades raramente mudam)
    maxAge: 60 * 60,
    // Chave única por UF
    getKey: event => `cidades-${getRouterParam(event, 'uf')?.toUpperCase()}`,
    // Stale-while-revalidate: serve cache antigo enquanto atualiza em background
    swr: true,
  },
)
