import type { Mesorregiao } from './useRegioes'

// Interface para microrregião do IBGE
export interface MicrorregiaoIBGE {
  id: number
  nome: string
  mesorregiao: {
    id: number
    nome: string
    UF: {
      id: number
      sigla: string
      nome: string
    }
  }
}

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
 * Usa a API do IBGE corretamente:
 * 1. Buscar mesorregião: /mesorregioes/{id}
 * 2. Buscar microrregiões: /mesorregioes/{id}/microrregioes
 * 3. Para cada microrregião, buscar municípios: /microrregioes/{id}/municipios
 */
export function useMesorregiao(mesorregiaoId: Ref<number | null>) {
  // Estado reativo
  const mesorregiao = ref<Mesorregiao | null>(null)
  const microrregioes = ref<MicrorregiaoIBGE[]>([])
  const municipios = ref<MunicipioIBGE[]>([])
  const loading = ref(true)

  // Função para buscar dados
  async function fetchData(id: number): Promise<void> {
    loading.value = true

    try {
      // Passo 1 e 2: Buscar mesorregião e suas microrregiões em paralelo
      const [mesoData, microData] = await Promise.all([
        $fetch<Mesorregiao>(
          `https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/${id}`,
        ),
        $fetch<MicrorregiaoIBGE[]>(
          `https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/${id}/microrregioes`,
        ),
      ])

      mesorregiao.value = mesoData
      microrregioes.value = microData

      // Passo 3: Buscar municípios de cada microrregião em paralelo
      if (microData.length > 0) {
        const municipiosPromises = microData.map(micro =>
          $fetch<MunicipioIBGE[]>(
            `https://servicodados.ibge.gov.br/api/v1/localidades/microrregioes/${micro.id}/municipios`,
          ),
        )

        const municipiosArrays = await Promise.all(municipiosPromises)

        // Juntar todos os municípios e ordenar por nome
        municipios.value = municipiosArrays
          .flat()
          .sort((a, b) => a.nome.localeCompare(b.nome))
      }
      else {
        municipios.value = []
      }
    }
    catch (e) {
      console.error('Erro ao buscar dados da mesorregião:', e)
      mesorregiao.value = null
      microrregioes.value = []
      municipios.value = []
    }
    finally {
      loading.value = false
    }
  }

  // Watch para buscar quando o ID mudar
  watch(mesorregiaoId, async (newId) => {
    if (newId) {
      await fetchData(newId)
    }
    else {
      mesorregiao.value = null
      microrregioes.value = []
      municipios.value = []
      loading.value = false
    }
  }, { immediate: true })

  // Lista de nomes de municípios para filtrar candidatos
  const nomesMunicipios = computed(() =>
    municipios.value.map(m => m.nome.toUpperCase()),
  )

  return {
    mesorregiao,
    microrregioes,
    municipios,
    nomesMunicipios,
    loading,
  }
}

/**
 * Composable para buscar candidatos mais votados em uma lista de municípios
 * Busca sob demanda (não automática)
 */
export function useCandidatosRegiao(
  nomesMunicipios: Ref<string[]>,
  uf: Ref<string | null>,
  ano: Ref<number>,
  cargo: Ref<string | null>,
) {
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string

  // Estado local
  const candidatosRaw = ref<Record<string, unknown>[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Função de refresh manual
  async function refresh(): Promise<void> {
    if (!uf.value || nomesMunicipios.value.length === 0) {
      candidatosRaw.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const { PostgrestClient } = await import('@supabase/postgrest-js')
      const client = new PostgrestClient(apiUrl)

      // Buscar candidatos dos municípios da região (view materializada otimizada)
      let query = client
        .from('mv_votos_municipio')
        .select('nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, total_votos, ds_sit_tot_turno, nm_municipio, nr_turno')
        .eq('sg_uf', uf.value)
        .eq('ano_eleicao', ano.value)
        .eq('nr_turno', 1)
        .in('nm_municipio', nomesMunicipios.value)
        .order('total_votos', { ascending: false })
        .limit(5000)

      if (cargo.value) {
        query = query.ilike('ds_cargo', `%${cargo.value}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Erro ao buscar candidatos:', fetchError)
        error.value = fetchError.message
        candidatosRaw.value = []
        return
      }

      candidatosRaw.value = data ?? []
    }
    catch (e) {
      console.error('Erro ao buscar candidatos:', e)
      error.value = String(e)
      candidatosRaw.value = []
    }
    finally {
      loading.value = false
    }
  }

  // Agregar candidatos (somar votos por candidato)
  const candidatos = computed<CandidatoRegiao[]>(() => {
    if (!candidatosRaw.value?.length)
      return []

    const mapa = new Map<string, CandidatoRegiao>()

    for (const row of candidatosRaw.value) {
      const key = `${row.nm_candidato}-${row.sg_partido}-${row.ds_cargo}`

      if (mapa.has(key)) {
        const existing = mapa.get(key)!
        existing.total_votos += Number(row.total_votos) || 0
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
          total_votos: Number(row.total_votos) || 0,
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
    loading,
    refresh,
  }
}
