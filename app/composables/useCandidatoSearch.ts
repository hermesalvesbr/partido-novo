import type { AnoEleicao, Cargo, Estado } from '~/data/eleicoes'

import { PostgrestClient } from '@supabase/postgrest-js'

// Interface para candidato na busca
export interface CandidatoBusca {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  qt_votos_nominais: number
  ds_sit_tot_turno: string
  nm_municipio?: string
  nr_turno?: number
}

// Tipo de busca
export type SearchType = 'candidato' | 'cidade'

// Filtros de busca
export interface SearchFilters {
  uf: Estado | null
  ano: AnoEleicao | null
  cidade: string | null
  cargo: Cargo | null
}

// Estado persistente da busca
interface SearchState {
  searched: boolean
  candidatos: CandidatoBusca[]
  searchQuery: string
  searchType: SearchType
  filters: SearchFilters
  error: string
}

// Estado inicial
function defaultState(): SearchState {
  return {
    searched: false,
    candidatos: [],
    searchQuery: '',
    searchType: 'candidato',
    filters: {
      uf: null,
      ano: null,
      cidade: null,
      cargo: null,
    },
    error: '',
  }
}

/**
 * Composable para busca de candidatos eleitorais
 * Usa useState para persistir estado entre navegações (Nuxt 4 best practice)
 * Encapsula toda a lógica de busca, filtros e agregação de resultados
 */
export function useCandidatoSearch() {
  // Runtime config para URL da API
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string
  const client = new PostgrestClient(apiUrl)

  // Estado persistente usando useState (SSR-friendly, persiste entre navegações)
  const state = useState<SearchState>('candidato-search-state', defaultState)

  // Estado local apenas para loading (não precisa persistir)
  const loading = ref(false)

  // Computed writable para searchQuery (compatibilidade com v-model)
  const searchQuery = computed({
    get: () => state.value.searchQuery,
    set: (value: string) => { state.value.searchQuery = value },
  })

  // Computed writable para searchType (compatibilidade com v-model)
  const searchType = computed({
    get: () => state.value.searchType,
    set: (value: SearchType) => { state.value.searchType = value },
  })

  // Filtros como objeto reativo (getters/setters para compatibilidade)
  const filters = reactive({
    get uf() { return state.value.filters.uf },
    set uf(value: Estado | null) { state.value.filters.uf = value },
    get ano() { return state.value.filters.ano },
    set ano(value: AnoEleicao | null) { state.value.filters.ano = value },
    get cidade() { return state.value.filters.cidade },
    set cidade(value: string | null) { state.value.filters.cidade = value },
    get cargo() { return state.value.filters.cargo },
    set cargo(value: Cargo | null) { state.value.filters.cargo = value },
  })

  // Computed: É eleição municipal?
  const isEleicaoMunicipal = computed(() => filters.ano === 2020 || filters.ano === 2024)

  // Computed: Contagem de filtros ativos
  const filterCount = computed(() => {
    let count = 0
    if (filters.uf)
      count++
    if (filters.ano)
      count++
    if (filters.cidade)
      count++
    if (filters.cargo)
      count++
    return count
  })

  // Computed: Pode buscar?
  const canSearch = computed(() => {
    // ========================================
    // BUSCA POR CANDIDATO
    // ========================================
    if (state.value.searchType === 'candidato') {
      // Precisa de pelo menos 3 caracteres ou filtros aplicados
      const hasQuery = state.value.searchQuery.trim().length >= 3
      const hasFilters = filters.uf !== null || filters.ano !== null || filters.cidade !== null
      return hasQuery || hasFilters
    }

    // ========================================
    // BUSCA POR CIDADE
    // ========================================
    // Precisa de UF obrigatório + cidade selecionada no v-select
    if (!filters.uf) {
      return false
    }

    // Precisa ter uma cidade selecionada (valor exato do v-select)
    const hasCidadeSelecionada = state.value.searchQuery.trim().length > 0
    return hasCidadeSelecionada
  })

  // Placeholder dinâmico
  const searchPlaceholder = computed(() =>
    state.value.searchType === 'candidato'
      ? 'Buscar nome do candidato...'
      : 'Buscar nome da cidade...',
  )

  // Ícone dinâmico
  const searchIcon = computed(() =>
    state.value.searchType === 'candidato'
      ? 'mdi-account-search'
      : 'mdi-city-variant',
  )

  /**
   * Agrupa resultados por candidato para somar votos de diferentes zonas
   */
  function aggregateCandidatos(rawData: Record<string, unknown>[]): CandidatoBusca[] {
    const grouped = new Map<string, CandidatoBusca>()

    for (const d of rawData) {
      const key = `${d.nm_urna_candidato}-${d.ano_eleicao}-${d.ds_cargo}-${d.sg_uf}-${d.nr_turno}`
      const existing = grouped.get(key)

      if (existing) {
        existing.qt_votos_nominais += (d.qt_votos_nominais as number) || 0
      }
      else {
        grouped.set(key, {
          nm_candidato: d.nm_candidato as string,
          nm_urna_candidato: d.nm_urna_candidato as string,
          sg_partido: d.sg_partido as string,
          ds_cargo: d.ds_cargo as string,
          ano_eleicao: d.ano_eleicao as number,
          sg_uf: d.sg_uf as string,
          qt_votos_nominais: (d.qt_votos_nominais as number) || 0,
          ds_sit_tot_turno: d.ds_sit_tot_turno as string,
          nr_turno: d.nr_turno as number,
        })
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.qt_votos_nominais - a.qt_votos_nominais)
      .slice(0, 50)
  }

  /**
   * Executa a busca de candidatos
   * - Busca por candidato: usa RPC fuzzy com pg_trgm (permite erro de digitação)
   * - Busca por cidade: usa eq com nome exato (v-select garante integridade)
   */
  async function search(): Promise<void> {
    if (!canSearch.value)
      return

    loading.value = true
    state.value.searched = true
    state.value.error = ''

    try {
      // ========================================
      // BUSCA POR CANDIDATO (fuzzy com pg_trgm)
      // ========================================
      if (state.value.searchType === 'candidato') {
        const term = state.value.searchQuery.trim()

        // Precisa de pelo menos 3 caracteres para busca fuzzy
        if (term.length >= 3) {
          // Construir URL para RPC via GET (evita timeout do POST)
          const params = new URLSearchParams()
          params.set('p_termo', term)
          if (filters.uf) params.set('p_uf', filters.uf)
          if (filters.ano) params.set('p_ano', String(filters.ano))
          if (filters.cargo) params.set('p_cargo', filters.cargo)
          if (filters.cidade) params.set('p_cidade', filters.cidade)
          params.set('p_limite', '500')

          const response = await fetch(`${apiUrl}/rpc/buscar_candidato_fuzzy?${params.toString()}`)
          
          if (!response.ok) {
            throw new Error(`Erro na busca: ${response.status}`)
          }

          const rawData = await response.json() as Record<string, unknown>[]
          state.value.candidatos = aggregateCandidatos(rawData)
        }
        else {
          // Sem termo de busca, retorna vazio
          state.value.candidatos = []
        }
      }
      // ========================================
      // BUSCA POR CIDADE (nome exato via v-select)
      // ========================================
      else {
        // searchQuery contém o nome exato da cidade (selecionado no v-select)
        const cidadeSelecionada = state.value.searchQuery.trim()

        if (!cidadeSelecionada) {
          state.value.candidatos = []
          return
        }

        const tableName = 'votacao_candidato_munzona'
        const votosField = 'qt_votos_nominais'
        const selectFields = `nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, ${votosField}, ds_sit_tot_turno, nr_turno, nm_municipio`

        let query = client
          .from(tableName)
          .select(selectFields)
          // Nome exato da cidade (garantido pelo v-select)
          .eq('nm_municipio', cidadeSelecionada)

        // Aplicar filtros obrigatórios
        if (filters.uf) {
          query = query.eq('sg_uf', filters.uf)
        }

        // Aplicar filtros opcionais
        if (filters.ano) {
          query = query.eq('ano_eleicao', filters.ano)
        }
        if (filters.cargo) {
          query = query.eq('ds_cargo', filters.cargo)
        }

        query = query
          .order(votosField, { ascending: false })
          .limit(500)

        const { data, error: err } = await query

        if (err)
          throw err

        const rawData = (data || []) as unknown as Record<string, unknown>[]

        // Agrupa votos por candidato (soma de diferentes zonas)
        state.value.candidatos = aggregateCandidatos(rawData)
      }
    }
    catch (e: unknown) {
      const err = e as Error
      state.value.error = err.message || 'Erro na busca'
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Limpa os resultados da busca
   */
  function clearResults(): void {
    state.value.candidatos = []
    state.value.searched = false
    state.value.error = ''
  }

  /**
   * Limpa os filtros
   */
  function clearFilters(): void {
    if (state.value.searchType === 'candidato') {
      state.value.filters.uf = null
      state.value.filters.ano = null
      state.value.filters.cidade = null
      state.value.filters.cargo = null
    }
    else {
      // Para busca por cidade, mantém UF
      state.value.filters.ano = null
      state.value.filters.cidade = null
      state.value.filters.cargo = null
    }
  }

  /**
   * Define o estado (UF) nos filtros
   */
  function setUf(uf: Estado | null): void {
    state.value.filters.uf = uf
  }

  /**
   * Reseta todo o estado da busca para o inicial
   */
  function resetState(): void {
    state.value = defaultState()
  }

  return {
    // Estado
    loading: readonly(loading),
    searched: computed(() => state.value.searched),
    error: computed(() => state.value.error),
    candidatos: computed(() => state.value.candidatos),
    searchQuery,
    searchType,
    filters,

    // Computed
    isEleicaoMunicipal,
    filterCount,
    canSearch,
    searchPlaceholder,
    searchIcon,

    // Métodos
    search,
    clearResults,
    clearFilters,
    setUf,
    resetState,
  }
}
