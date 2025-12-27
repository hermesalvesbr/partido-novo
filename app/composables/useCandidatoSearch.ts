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

// Opções de configuração
interface UseCandidatoSearchOptions {
  initialFilters?: Partial<SearchFilters>
}

/**
 * Composable para busca de candidatos eleitorais
 * Encapsula toda a lógica de busca, filtros e agregação de resultados
 */
export function useCandidatoSearch(options: UseCandidatoSearchOptions = {}) {
  // Runtime config para URL da API
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.postgrestUrl as string
  const client = new PostgrestClient(apiUrl)

  // Estado reativo
  const loading = ref(false)
  const searched = ref(false)
  const error = ref('')
  const candidatos = ref<CandidatoBusca[]>([])
  const searchQuery = ref('')
  const searchType = ref<SearchType>('candidato')

  // Filtros
  const filters = reactive<SearchFilters>({
    uf: options.initialFilters?.uf ?? null,
    ano: options.initialFilters?.ano ?? null,
    cidade: options.initialFilters?.cidade ?? null,
    cargo: options.initialFilters?.cargo ?? null,
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
    const hasQuery = searchQuery.value.trim().length >= 3
    const hasFilters = filters.uf !== null || filters.ano !== null || filters.cidade !== null

    // Busca por cidade exige UF
    if (searchType.value === 'cidade' && !filters.uf) {
      return false
    }

    return hasQuery || hasFilters
  })

  // Placeholder dinâmico
  const searchPlaceholder = computed(() =>
    searchType.value === 'candidato'
      ? 'Buscar nome do candidato...'
      : 'Buscar nome da cidade...',
  )

  // Ícone dinâmico
  const searchIcon = computed(() =>
    searchType.value === 'candidato'
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
   */
  async function search(): Promise<void> {
    if (!canSearch.value)
      return

    loading.value = true
    searched.value = true
    error.value = ''

    try {
      const tableName = 'votacao_candidato_munzona'
      const votosField = 'qt_votos_nominais'
      const selectFields = `nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, ${votosField}, ds_sit_tot_turno, nr_turno, nm_municipio`

      let query = client
        .from(tableName)
        .select(selectFields)

      // Busca por termo
      const term = searchQuery.value.trim()
      if (term.length >= 3) {
        const termPattern = `%${term.replace(/\s+/g, '%')}%`

        if (searchType.value === 'candidato') {
          query = query.ilike('nm_urna_candidato', termPattern)
        }
        else {
          query = query.ilike('nm_municipio', termPattern)
        }
      }

      // Aplicar filtros
      if (filters.uf) {
        query = query.eq('sg_uf', filters.uf)
      }
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

      if (searchType.value === 'candidato') {
        candidatos.value = aggregateCandidatos(rawData)
      }
      else {
        candidatos.value = rawData.map(d => ({
          ...d,
          qt_votos_nominais: (d.qt_votos_nominais as number) || 0,
        })) as CandidatoBusca[]
      }
    }
    catch (e: unknown) {
      const err = e as Error
      error.value = err.message || 'Erro na busca'
    }
    finally {
      loading.value = false
    }
  }

  /**
   * Limpa os resultados da busca
   */
  function clearResults(): void {
    candidatos.value = []
    searched.value = false
    error.value = ''
  }

  /**
   * Limpa os filtros
   */
  function clearFilters(): void {
    if (searchType.value === 'candidato') {
      filters.uf = null
      filters.ano = null
      filters.cidade = null
      filters.cargo = null
    }
    else {
      // Para busca por cidade, mantém UF
      filters.ano = null
      filters.cidade = null
      filters.cargo = null
    }
  }

  /**
   * Define o estado (UF) nos filtros
   */
  function setUf(uf: Estado | null): void {
    filters.uf = uf
  }

  return {
    // Estado
    loading: readonly(loading),
    searched: readonly(searched),
    error: readonly(error),
    candidatos: readonly(candidatos),
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
  }
}
