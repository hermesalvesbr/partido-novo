/**
 * API para retornar candidatos mais acessados por UF
 *
 * GET /api/trending/:uf
 * Retorna: Top 3 candidatos mais acessados da UF nos últimos 30 dias
 *
 * Cache de 5 minutos para evitar leituras excessivas do KV
 */

// Constantes de tempo
const MS_PER_DAY = 24 * 60 * 60 * 1000
const TRENDING_WINDOW_DAYS = 30 // Exibe trending dos últimos 30 dias

interface CandidatoMeta {
  nome: string
  nomeCompleto: string
  partido: string
  cargo: string
  anoEleicao: number
  situacao: string
  totalVotos: number
  lastAccess: number
}

interface TrendingCandidato {
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

export default defineCachedEventHandler(
  async (event) => {
    const uf = getRouterParam(event, 'uf')?.toUpperCase()

    if (!uf || uf.length !== 2) {
      throw createError({
        statusCode: 400,
        message: 'UF inválida',
      })
    }

    try {
      const storage = useStorage('cache')
      const indexKey = `trending:index:${uf}`
      const now = Date.now()
      const cutoff30Days = now - (TRENDING_WINDOW_DAYS * MS_PER_DAY)

      // Buscar índice de candidatos trackados para esta UF
      const index = await storage.getItem<string[]>(indexKey) || []

      if (index.length === 0) {
        return []
      }

      // Buscar hits e metadados em paralelo
      const candidatos: TrendingCandidato[] = []

      await Promise.all(
        index.map(async (slug) => {
          const hitsKey = `trending:hits:${uf}:${slug}`
          const metaKey = `trending:meta:${uf}:${slug}`

          const [hits, meta] = await Promise.all([
            storage.getItem<number[]>(hitsKey),
            storage.getItem<CandidatoMeta>(metaKey),
          ])

          // Validar dados completos (evita mostrar candidatos com dados incompletos)
          if (!meta || !meta.cargo || !meta.anoEleicao || meta.totalVotos === 0) {
            return // Pula candidatos com dados incompletos
          }

          // Contar apenas acessos dos últimos 30 dias
          const recentHits = hits?.filter(t => t > cutoff30Days) || []
          const acessos30Dias = recentHits.length

          // Só inclui se teve acessos nos últimos 30 dias
          if (acessos30Dias > 0) {
            candidatos.push({
              slug,
              nome: meta.nome,
              nomeCompleto: meta.nomeCompleto || meta.nome,
              partido: meta.partido || '',
              cargo: meta.cargo,
              anoEleicao: meta.anoEleicao,
              situacao: meta.situacao || '',
              totalVotos: meta.totalVotos,
              acessos: acessos30Dias,
            })
          }
        }),
      )

      // Ordenar por acessos (desc) e retornar top 3
      return candidatos
        .sort((a, b) => b.acessos - a.acessos)
        .slice(0, 3)
    }
    catch (error) {
      console.error('Erro ao buscar trending:', error)
      return []
    }
  },
  {
    // Cache de 1 minuto em dev, 5 minutos em prod
    maxAge: import.meta.env.NODE_ENV === 'development' ? 60 : 60 * 5,
    staleMaxAge: 60 * 2,
    swr: true,
    base: 'cache',
    group: 'trending',
    // v4: nova chave com filtro de 30 dias
    getKey: event => `v4:top30d:${getRouterParam(event, 'uf')?.toUpperCase() || 'unknown'}`,
  },
)
