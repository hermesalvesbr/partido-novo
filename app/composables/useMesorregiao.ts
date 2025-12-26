import type { Mesorregiao } from './useRegioes'

// Interface para município do IBGE
export interface MunicipioIBGE {
  id: number
  nome: string
  microrregiao: {
    id: number
    nome: string
    mesorregiao: {
      id: number
      nome: string
    }
  }
}

// Interface para candidato agregado por região
export interface CandidatoRegiao {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  total_votos: number
  ds_sit_tot_turno: string
  municipios_votados: string[]
}

// Interface para estatísticas da região
export interface StatsRegiao {
  total_votos: number
  total_candidatos: number
  total_partidos: number
  top_partido: string
  top_candidato: string
}

/**
 * Composable para buscar dados de uma mesorregião específica
 * Inclui municípios e candidatos mais votados
 */
export function useMesorregiao(mesorregiaoId: Ref<number | null>) {
  // Key computada para cache
  const mesoKey = computed(() => `ibge-mesorregiao-${mesorregiaoId.value}`)

  // Buscar dados da mesorregião
  const { data: mesorregiao, status: statusMeso } = useAsyncData<Mesorregiao | null>(
    mesoKey,
    async () => {
      if (!mesorregiaoId.value)
        return null

      const data = await $fetch<Mesorregiao>(
        `https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/${mesorregiaoId.value}`,
      )
      return data
    },
    {
      watch: [mesorregiaoId],
      immediate: true,
      getCachedData(key, nuxtApp, ctx) {
        if (ctx.cause === 'refresh:manual')
          return undefined
        return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
      },
    },
  )

  // Key computada para municípios
  const municKey = computed(() => `ibge-municipios-mesorregiao-${mesorregiaoId.value}`)

  // Buscar municípios da mesorregião
  const { data: municipios, status: statusMunic } = useAsyncData<MunicipioIBGE[]>(
    municKey,
    async () => {
      if (!mesorregiaoId.value)
        return []

      const data = await $fetch<MunicipioIBGE[]>(
        `https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/${mesorregiaoId.value}/municipios`,
        { query: { orderBy: 'nome' } },
      )
      return data
    },
    {
      watch: [mesorregiaoId],
      immediate: true,
      getCachedData(key, nuxtApp, ctx) {
        if (ctx.cause === 'refresh:manual')
          return undefined
        return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
      },
      default: () => [],
    },
  )

  // Lista de nomes de municípios para filtrar candidatos
  const nomesMunicipios = computed(() =>
    municipios.value?.map(m => m.nome.toUpperCase()) ?? [],
  )

  return {
    mesorregiao,
    municipios,
    nomesMunicipios,
    loading: computed(() => statusMeso.value === 'pending' || statusMunic.value === 'pending'),
  }
}

/**
 * Composable para buscar candidatos mais votados em uma lista de municípios
 */
export function useCandidatosRegiao(
  nomesMunicipios: Ref<string[]>,
  uf: Ref<string | null>,
  ano: Ref<number>,
  cargo: Ref<string | null>,
) {
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string

  // Key computada para candidatos
  const candidatosKey = computed(() => `candidatos-regiao-${uf.value}-${ano.value}-${cargo.value}`)

  const { data: candidatosRaw, status, refresh } = useAsyncData<Record<string, unknown>[]>(
    candidatosKey,
    async () => {
      if (!uf.value || nomesMunicipios.value.length === 0)
        return []

      const { PostgrestClient } = await import('@supabase/postgrest-js')
      const client = new PostgrestClient(apiUrl)

      // Buscar candidatos dos municípios da região
      let query = client
        .from('votacao_candidato_munzona')
        .select('nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, qt_votos_nominais, ds_sit_tot_turno, nm_municipio, nr_turno')
        .eq('sg_uf', uf.value)
        .eq('ano_eleicao', ano.value)
        .eq('nr_turno', 1)
        .in('nm_municipio', nomesMunicipios.value)
        .order('qt_votos_nominais', { ascending: false })
        .limit(5000)

      if (cargo.value) {
        query = query.ilike('ds_cargo', `%${cargo.value}%`)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar candidatos:', error)
        return []
      }

      return data ?? []
    },
    {
      watch: [nomesMunicipios, uf, ano, cargo],
      immediate: false,
      getCachedData(key, nuxtApp, ctx) {
        if (ctx.cause === 'refresh:manual')
          return undefined
        return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
      },
      default: () => [],
    },
  )

  // Agregar candidatos (somar votos por candidato)
  const candidatos = computed<CandidatoRegiao[]>(() => {
    if (!candidatosRaw.value?.length)
      return []

    const mapa = new Map<string, CandidatoRegiao>()

    for (const row of candidatosRaw.value) {
      const key = `${row.nm_candidato}-${row.sg_partido}-${row.ds_cargo}`

      if (mapa.has(key)) {
        const existing = mapa.get(key)!
        existing.total_votos += Number(row.qt_votos_nominais) || 0
        if (!existing.municipios_votados.includes(String(row.nm_municipio))) {
          existing.municipios_votados.push(String(row.nm_municipio))
        }
      }
      else {
        mapa.set(key, {
          nm_candidato: String(row.nm_candidato),
          nm_urna_candidato: String(row.nm_urna_candidato),
          sg_partido: String(row.sg_partido),
          ds_cargo: String(row.ds_cargo),
          ano_eleicao: Number(row.ano_eleicao),
          sg_uf: String(row.sg_uf),
          total_votos: Number(row.qt_votos_nominais) || 0,
          ds_sit_tot_turno: String(row.ds_sit_tot_turno),
          municipios_votados: [String(row.nm_municipio)],
        })
      }
    }

    return Array.from(mapa.values())
      .sort((a, b) => b.total_votos - a.total_votos)
  })

  // Estatísticas da região
  const stats = computed<StatsRegiao>(() => {
    if (!candidatos.value.length) {
      return {
        total_votos: 0,
        total_candidatos: 0,
        total_partidos: 0,
        top_partido: '-',
        top_candidato: '-',
      }
    }

    const partidos = new Map<string, number>()
    let totalVotos = 0

    for (const c of candidatos.value) {
      totalVotos += c.total_votos
      partidos.set(c.sg_partido, (partidos.get(c.sg_partido) || 0) + c.total_votos)
    }

    const topPartido = [...partidos.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      total_votos: totalVotos,
      total_candidatos: candidatos.value.length,
      total_partidos: partidos.size,
      top_partido: topPartido?.[0] ?? '-',
      top_candidato: candidatos.value[0]?.nm_urna_candidato ?? '-',
    }
  })

  return {
    candidatos,
    stats,
    loading: computed(() => status.value === 'pending'),
    refresh,
  }
}
