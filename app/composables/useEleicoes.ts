import type { CandidatoVotos, StatsAno, StatsPartido, TopCandidato } from '~/data/eleicoes'

// Usa o proxy local para evitar problemas de CORS
// Em desenvolvimento: /api/proxy/
// Em produção: usa o proxy também (configurado no Cloudflare)
const API_BASE = '/api/proxy'

interface SearchFilters {
  candidato?: string
  partido?: string
  uf?: string
  ano?: number
  cargo?: string
  turno?: number
  limit?: number
}

/**
 * Composable para acessar as views materializadas via PostgREST
 * Utiliza fetch direto para a API pública
 */
export function useEleicoes() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Busca estatísticas gerais por ano de eleição
   * Usa a view materializada: mv_stats_ano
   */
  async function getStatsAno(): Promise<StatsAno[]> {
    const response = await $fetch<StatsAno[]>(`${API_BASE}/mv_stats_ano`, {
      query: { order: 'ano_eleicao.desc' },
    })
    return response
  }

  /**
   * Busca os top candidatos mais votados
   * Usa a view materializada: mv_top_candidatos
   */
  async function getTopCandidatos(limit = 10): Promise<TopCandidato[]> {
    const response = await $fetch<TopCandidato[]>(`${API_BASE}/mv_top_candidatos`, {
      query: {
        order: 'total_votos.desc',
        limit,
      },
    })
    return response
  }

  /**
   * Busca estatísticas agregadas por partido
   * Usa a view materializada: mv_stats_partido
   */
  async function getStatsPartido(limit = 10): Promise<StatsPartido[]> {
    // Agrupa por partido e soma os votos
    const response = await $fetch<StatsPartido[]>(`${API_BASE}/mv_stats_partido`, {
      query: {
        select: 'sg_partido,nm_partido,total_votos,total_candidatos',
        order: 'total_votos.desc',
        limit: limit * 4, // Pegamos mais porque há duplicatas por ano/cargo
      },
    })

    // Agrupa manualmente por partido (já que PostgREST não suporta GROUP BY)
    const partidoMap = new Map<string, StatsPartido>()
    for (const p of response) {
      const existing = partidoMap.get(p.sg_partido)
      if (existing) {
        existing.total_votos += p.total_votos
        existing.total_candidatos += p.total_candidatos
      }
      else {
        partidoMap.set(p.sg_partido, { ...p })
      }
    }

    return Array.from(partidoMap.values())
      .sort((a, b) => b.total_votos - a.total_votos)
      .slice(0, limit)
  }

  /**
   * Busca candidatos com filtros
   * Usa a view materializada: mv_votos_candidato
   */
  async function searchCandidatos(filters: SearchFilters): Promise<CandidatoVotos[]> {
    loading.value = true
    error.value = null

    try {
      const query: Record<string, string> = {
        order: 'total_votos.desc',
        limit: String(filters.limit || 50),
      }

      // Filtro por nome do candidato (busca parcial case-insensitive)
      if (filters.candidato) {
        query.nm_candidato = `ilike.*${filters.candidato}*`
      }

      // Filtro por partido (exato)
      if (filters.partido) {
        query.sg_partido = `eq.${filters.partido}`
      }

      // Filtro por UF (exato)
      if (filters.uf) {
        query.sg_uf = `eq.${filters.uf}`
      }

      // Filtro por ano (exato)
      if (filters.ano) {
        query.ano_eleicao = `eq.${filters.ano}`
      }

      // Filtro por cargo (busca parcial case-insensitive)
      if (filters.cargo) {
        query.ds_cargo = `ilike.*${filters.cargo}*`
      }

      // Filtro por turno (exato)
      if (filters.turno) {
        query.nr_turno = `eq.${filters.turno}`
      }

      const response = await $fetch<CandidatoVotos[]>(`${API_BASE}/mv_votos_candidato`, { query })
      return response
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Erro ao buscar candidatos'
      console.error('Erro ao buscar candidatos:', err)
      return []
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Busca histórico eleitoral de um candidato por nome
   * Retorna todas as eleições em que o candidato participou
   */
  async function getHistoricoCandidato(nomeCandidato: string): Promise<CandidatoVotos[]> {
    if (!nomeCandidato || nomeCandidato.length < 3)
      return []

    const response = await $fetch<CandidatoVotos[]>(`${API_BASE}/mv_votos_candidato`, {
      query: {
        nm_candidato: `ilike.*${nomeCandidato}*`,
        order: 'ano_eleicao.desc,total_votos.desc',
        limit: '100',
      },
    })

    return response
  }

  return {
    loading: readonly(loading),
    error: readonly(error),
    getStatsAno,
    getTopCandidatos,
    getStatsPartido,
    searchCandidatos,
    getHistoricoCandidato,
  }
}
