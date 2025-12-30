import { PostgrestClient } from '@supabase/postgrest-js'

/**
 * API para listar cidades por UF
 * Usa defineCachedEventHandler para cache no Cloudflare KV
 * Cache de 1 ano - cidades NUNCA mudam (são definidas pelo IBGE)
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
    // Cache de 1 ano no Cloudflare KV (cidades nunca mudam)
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    // Serve stale indefinidamente enquanto revalida em background
    staleMaxAge: -1,
    // Usa o storage 'cache' configurado no nuxt.config.ts (Cloudflare KV)
    base: 'cache',
    // Nome do grupo para organização no KV
    group: 'cidades',
    // Chave única por UF
    getKey: event => `v1:${getRouterParam(event, 'uf')?.toUpperCase() || 'unknown'}`,
    // Stale-while-revalidate: serve cache antigo enquanto atualiza em background
    swr: true,
    // NOTA: Erros (throw createError) NÃO são cacheados pelo Nitro automaticamente
  },
)
