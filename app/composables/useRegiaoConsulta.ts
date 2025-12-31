import type { CandidatoRegiao, MunicipioIBGE, StatsRegiao } from '~/composables/useMesorregiao'
import type { AnoEleicao, Cargo } from '~/data/eleicoes'

/**
 * Estado persistente da consulta de região
 * Armazenado por ID da mesorregião para permitir múltiplas consultas
 */
interface RegiaoConsultaState {
  mesorregiaoId: number | null
  municipiosSelecionados: MunicipioIBGE[]
  anoSelecionado: AnoEleicao
  cargoSelecionado: Cargo | null
  consultaIniciada: boolean
  // Resultados persistidos
  candidatosRaw: Record<string, unknown>[]
}

// Estado inicial
function defaultState(): RegiaoConsultaState {
  return {
    mesorregiaoId: null,
    municipiosSelecionados: [],
    anoSelecionado: 2024,
    cargoSelecionado: null,
    consultaIniciada: false,
    candidatosRaw: [],
  }
}

/**
 * Composable para persistir estado da consulta de região entre navegações
 * Usa useState para manter os filtros, seleções E RESULTADOS quando o usuário volta da página do candidato
 */
export function useRegiaoConsulta(mesorregiaoId: Ref<number | null>) {
  // Runtime config para URL da API
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string

  // Estado persistente usando useState (SSR-friendly, persiste entre navegações)
  const state = useState<RegiaoConsultaState>('regiao-consulta-state', defaultState)

  // Loading local (não persiste)
  const loading = ref(false)

  // Se mudou de mesorregião, resetar estado
  watch(mesorregiaoId, (newId, oldId) => {
    if (newId !== null && newId !== oldId && state.value.mesorregiaoId !== newId) {
      // Resetar para nova mesorregião
      state.value = {
        ...defaultState(),
        mesorregiaoId: newId,
      }
    }
  }, { immediate: true })

  // Municípios selecionados
  const municipiosSelecionados = computed({
    get: () => state.value.municipiosSelecionados,
    set: (value: MunicipioIBGE[]) => { state.value.municipiosSelecionados = value },
  })

  // Ano selecionado
  const anoSelecionado = computed({
    get: () => state.value.anoSelecionado,
    set: (value: AnoEleicao) => { state.value.anoSelecionado = value },
  })

  // Cargo selecionado
  const cargoSelecionado = computed({
    get: () => state.value.cargoSelecionado,
    set: (value: Cargo | null) => { state.value.cargoSelecionado = value },
  })

  // Consulta iniciada
  const consultaIniciada = computed({
    get: () => state.value.consultaIniciada,
    set: (value: boolean) => { state.value.consultaIniciada = value },
  })

  /**
   * Inicializar municípios selecionados (só se ainda não tiver seleção para esta mesorregião)
   */
  function initMunicipios(municipios: MunicipioIBGE[]): void {
    // Só inicializa se:
    // 1. Não tem municípios selecionados
    // 2. É a mesma mesorregião ou primeira vez
    if (state.value.municipiosSelecionados.length === 0 && municipios.length > 0) {
      state.value.municipiosSelecionados = [...municipios]
      state.value.mesorregiaoId = mesorregiaoId.value
    }
  }

  /**
   * Remover município da seleção
   */
  function removerMunicipio(mun: MunicipioIBGE): void {
    state.value.municipiosSelecionados = state.value.municipiosSelecionados.filter(
      m => m.id !== mun.id,
    )
  }

  /**
   * Restaurar todos os municípios
   */
  function restaurarTodos(municipios: MunicipioIBGE[]): void {
    state.value.municipiosSelecionados = [...municipios]
  }

  /**
   * Marcar consulta como iniciada
   */
  function marcarConsultaIniciada(): void {
    state.value.consultaIniciada = true
  }

  /**
   * Resetar estado
   */
  function resetState(): void {
    state.value = defaultState()
  }

  /**
   * Buscar candidatos da região
   */
  async function buscarCandidatos(
    uf: string | null,
    nomesMunicipios: string[],
  ): Promise<void> {
    if (!uf || nomesMunicipios.length === 0) {
      state.value.candidatosRaw = []
      return
    }

    loading.value = true

    try {
      const { PostgrestClient } = await import('@supabase/postgrest-js')
      const client = new PostgrestClient(apiUrl)

      // Buscar candidatos dos municípios da região
      let query = client
        .from('mv_votos_municipio')
        .select('nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, total_votos, ds_sit_tot_turno, nm_municipio, nr_turno')
        .eq('sg_uf', uf)
        .eq('ano_eleicao', state.value.anoSelecionado)
        .eq('nr_turno', 1)
        .in('nm_municipio', nomesMunicipios)
        .order('total_votos', { ascending: false })
        .limit(5000)

      if (state.value.cargoSelecionado) {
        query = query.ilike('ds_cargo', `%${state.value.cargoSelecionado}%`)
      }

      const { data, error: fetchError } = await query

      if (fetchError) {
        console.error('Erro ao buscar candidatos:', fetchError)
        state.value.candidatosRaw = []
        return
      }

      state.value.candidatosRaw = data ?? []
    }
    catch (e) {
      console.error('Erro ao buscar candidatos:', e)
      state.value.candidatosRaw = []
    }
    finally {
      loading.value = false
    }
  }

  // Agregar candidatos (somar votos por candidato)
  const candidatos = computed<CandidatoRegiao[]>(() => {
    if (!state.value.candidatosRaw?.length)
      return []

    const mapa = new Map<string, CandidatoRegiao>()

    for (const row of state.value.candidatosRaw) {
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
    // Estado reativo
    municipiosSelecionados,
    anoSelecionado,
    cargoSelecionado,
    consultaIniciada,
    candidatos,
    stats,
    loading: readonly(loading),

    // Métodos
    initMunicipios,
    removerMunicipio,
    restaurarTodos,
    marcarConsultaIniciada,
    buscarCandidatos,
    resetState,
  }
}
