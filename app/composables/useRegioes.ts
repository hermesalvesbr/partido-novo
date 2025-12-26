import type { Estado } from '~/data/eleicoes'

// Tipos para a API do IBGE
export interface RegiaoIBGE {
  id: number
  sigla: string
  nome: string
}

export interface UFIBGE {
  id: number
  sigla: string
  nome: string
  regiao: RegiaoIBGE
}

export interface Mesorregiao {
  id: number
  nome: string
  UF: UFIBGE
  // Quantidade de municípios (calculada)
  municipiosCount?: number
}

// Interface para município do IBGE (simplificada para contagem)
interface MunicipioContagem {
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

// Mapeamento de sigla UF para código IBGE
const UF_CODES: Record<Estado, number> = {
  AC: 12,
  AL: 27,
  AM: 13,
  AP: 16,
  BA: 29,
  CE: 23,
  DF: 53,
  ES: 32,
  GO: 52,
  MA: 21,
  MG: 31,
  MS: 50,
  MT: 51,
  PA: 15,
  PB: 25,
  PE: 26,
  PI: 22,
  PR: 41,
  RJ: 33,
  RN: 24,
  RO: 11,
  RR: 14,
  RS: 43,
  SC: 42,
  SE: 28,
  SP: 35,
  TO: 17,
}

/**
 * Composable para buscar mesorregiões do IBGE com cache via useAsyncData
 * Utiliza cache do Nuxt 4 para evitar requisições duplicadas
 * Inclui contagem de municípios por mesorregião
 */
export function useRegioes(uf: Ref<Estado | null>) {
  const ufCode = computed(() => (uf.value ? UF_CODES[uf.value] : null))

  // useAsyncData com key dinâmica baseada no UF para cache eficiente
  const { data: mesorregioes, status, error, refresh } = useAsyncData<Mesorregiao[]>(
    () => `ibge-mesorregioes-completo-${uf.value}`,
    async () => {
      if (!ufCode.value)
        return []

      // Buscar mesorregiões e todos os municípios do estado em paralelo
      const [mesosData, municipiosData] = await Promise.all([
        $fetch<Mesorregiao[]>(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufCode.value}/mesorregioes`,
        ),
        $fetch<MunicipioContagem[]>(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufCode.value}/municipios`,
        ),
      ])

      // Contar municípios por mesorregião
      const contagemPorMeso = new Map<number, number>()
      for (const mun of municipiosData) {
        const mesoId = mun.microrregiao.mesorregiao.id
        contagemPorMeso.set(mesoId, (contagemPorMeso.get(mesoId) || 0) + 1)
      }

      // Adicionar contagem às mesorregiões
      return mesosData.map(meso => ({
        ...meso,
        municipiosCount: contagemPorMeso.get(meso.id) || 0,
      }))
    },
    {
      // Watch para reagir a mudanças no UF
      watch: [uf],
      // Executar imediatamente se tiver UF
      immediate: !!uf.value,
      // Cache: usar dados em cache se disponíveis (não refetch em navegação)
      getCachedData(key, nuxtApp, ctx) {
        // Se for refresh manual, sempre buscar novos dados
        if (ctx.cause === 'refresh:manual')
          return undefined

        // Usar cache do payload (SSR) ou dados estáticos
        const cachedData = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
        if (cachedData)
          return cachedData

        return undefined
      },
      // Valor padrão vazio
      default: () => [],
    },
  )

  // Computed para loading state
  const loading = computed(() => status.value === 'pending')

  // Computed para erro formatado
  const errorMessage = computed(() => {
    if (!error.value)
      return null
    return 'Erro ao carregar regiões. Tente novamente.'
  })

  return {
    mesorregioes,
    loading,
    error: errorMessage,
    refresh,
  }
}
