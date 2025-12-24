import { PostgrestClient } from '@supabase/postgrest-js'

export function usePostgrest() {
  const runtimeConfig = useRuntimeConfig()
  const POSTGREST_URL = runtimeConfig.public.postgrestUrl as string
  const client = new PostgrestClient(POSTGREST_URL)

  return {
    client,

    // Tabela principal de votação
    votacao: () => client.from('votacao_candidato_munzona'),

    // Helpers para queries comuns
    async getStats() {
      // Estatísticas por ano
      const { data: byYear, error: errYear } = await client
        .from('votacao_candidato_munzona')
        .select('ano_eleicao, sq_candidato, nm_municipio, sg_partido, qt_votos_nominais')

      if (errYear)
        throw errYear

      // Agrupa no cliente já que PostgREST não suporta agregações complexas diretamente
      const statsMap = new Map<number, {
        ano_eleicao: number
        candidatos: Set<string>
        municipios: Set<string>
        partidos: Set<string>
        total_votos: number
      }>()

      byYear?.forEach((row) => {
        const ano = row.ano_eleicao
        if (!statsMap.has(ano)) {
          statsMap.set(ano, {
            ano_eleicao: ano,
            candidatos: new Set(),
            municipios: new Set(),
            partidos: new Set(),
            total_votos: 0,
          })
        }
        const s = statsMap.get(ano)!
        s.candidatos.add(row.sq_candidato)
        s.municipios.add(row.nm_municipio)
        s.partidos.add(row.sg_partido)
        s.total_votos += Number(row.qt_votos_nominais) || 0
      })

      return Array.from(statsMap.values()).map(s => ({
        ano_eleicao: s.ano_eleicao,
        total_candidatos: s.candidatos.size,
        total_municipios: s.municipios.size,
        total_partidos: s.partidos.size,
        total_votos: s.total_votos,
      })).sort((a, b) => b.ano_eleicao - a.ano_eleicao)
    },

    async searchCandidatos(filters: {
      candidato?: string
      partido?: string
      uf?: string
      municipio?: string
      ano?: number
      cargo?: string
      turno?: number
      page?: number
      limit?: number
    }) {
      const { page = 1, limit = 50 } = filters
      const offset = (page - 1) * limit

      let query = client
        .from('votacao_candidato_munzona')
        .select('*', { count: 'exact' })

      if (filters.candidato) {
        query = query.ilike('nm_candidato', `%${filters.candidato}%`)
      }
      if (filters.partido) {
        query = query.eq('sg_partido', filters.partido.toUpperCase())
      }
      if (filters.uf) {
        query = query.eq('sg_uf', filters.uf.toUpperCase())
      }
      if (filters.municipio) {
        query = query.ilike('nm_municipio', `%${filters.municipio}%`)
      }
      if (filters.ano) {
        query = query.eq('ano_eleicao', filters.ano)
      }
      if (filters.cargo) {
        query = query.ilike('ds_cargo', `%${filters.cargo}%`)
      }
      if (filters.turno) {
        query = query.eq('nr_turno', filters.turno)
      }

      query = query
        .order('qt_votos_nominais', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error)
        throw error

      return {
        data: data || [],
        pagination: {
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
          page,
          limit,
        },
      }
    },

    async getTopCandidatos(limit = 10) {
      const { data, error } = await client
        .from('votacao_candidato_munzona')
        .select('nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, qt_votos_nominais, ds_sit_tot_turno')
        .eq('nr_turno', 1)
        .order('qt_votos_nominais', { ascending: false })
        .limit(limit)

      if (error)
        throw error
      return data
    },

    async getTopPartidos(limit = 10) {
      const { data, error } = await client
        .from('votacao_candidato_munzona')
        .select('sg_partido, nm_partido, qt_votos_nominais')

      if (error)
        throw error

      // Agrupa por partido no cliente
      const partidoMap = new Map<string, { sg_partido: string, nm_partido: string, total_votos: number, total_candidatos: Set<string> }>()

      data?.forEach((row) => {
        const key = row.sg_partido
        if (!partidoMap.has(key)) {
          partidoMap.set(key, {
            sg_partido: row.sg_partido,
            nm_partido: row.nm_partido,
            total_votos: 0,
            total_candidatos: new Set(),
          })
        }
        const p = partidoMap.get(key)!
        p.total_votos += Number(row.qt_votos_nominais) || 0
      })

      return Array.from(partidoMap.values())
        .map(p => ({
          sg_partido: p.sg_partido,
          nm_partido: p.nm_partido,
          total_votos: p.total_votos,
          total_candidatos: p.total_candidatos.size,
        }))
        .sort((a, b) => b.total_votos - a.total_votos)
        .slice(0, limit)
    },

    async getByUF() {
      const { data, error } = await client
        .from('votacao_candidato_munzona')
        .select('sg_uf, sq_candidato, qt_votos_nominais')

      if (error)
        throw error

      const ufMap = new Map<string, { sg_uf: string, candidatos: Set<string>, total_votos: number }>()

      data?.forEach((row) => {
        if (!ufMap.has(row.sg_uf)) {
          ufMap.set(row.sg_uf, { sg_uf: row.sg_uf, candidatos: new Set(), total_votos: 0 })
        }
        const u = ufMap.get(row.sg_uf)!
        u.candidatos.add(row.sq_candidato)
        u.total_votos += Number(row.qt_votos_nominais) || 0
      })

      return Array.from(ufMap.values())
        .map(u => ({
          sg_uf: u.sg_uf,
          total_candidatos: u.candidatos.size,
          total_votos: u.total_votos,
        }))
        .sort((a, b) => b.total_votos - a.total_votos)
    },
  }
}
