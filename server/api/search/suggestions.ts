/**
 * API de Sugestões para Typeahead de Candidatos
 *
 * Endpoint cacheado no Cloudflare KV (1 hora) para respostas rápidas.
 * Chama a RPC existente `buscar_candidato_fuzzy` com limite reduzido (15).
 * Faz agregação de votos no servidor para compatibilidade com CandidatoCard.
 *
 * Query params:
 * - termo: string (obrigatório, mínimo 3 caracteres)
 * - uf: string (opcional, ex: "PE")
 *
 * Retorna: CandidatoBusca[] (máximo 15 itens, ordenados por votos)
 */
export default defineCachedEventHandler(
  async (event) => {
    const query = getQuery(event)

    const termo = (query.termo as string)?.trim()
    const uf = (query.uf as string)?.toUpperCase()

    // Validação
    if (!termo || termo.length < 3) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Termo deve ter pelo menos 3 caracteres',
      })
    }

    const config = useRuntimeConfig()
    const apiUrl = config.public.postgrestUrl as string

    // Construir URL para RPC buscar_candidato_fuzzy
    const params = new URLSearchParams()
    params.set('p_termo', termo)
    if (uf)
      params.set('p_uf', uf)
    // Limite alto para garantir agregação correta de votos por zona eleitoral
    // PE tem ~209 zonas, então 500 é seguro para capturar todos os registros
    params.set('p_limite', '500')

    const response = await $fetch<Record<string, unknown>[]>(
      `${apiUrl}/rpc/buscar_candidato_fuzzy?${params.toString()}`,
    )

    // Agregar votos por candidato (mesmo candidato em diferentes zonas)
    const aggregated = aggregateCandidatos(response)

    return aggregated
  },
  {
    // Cache de 3 meses no Cloudflare KV (dados eleitorais são estáveis)
    maxAge: 60 * 60 * 24 * 90, // 3 meses
    // Serve stale indefinidamente enquanto revalida
    staleMaxAge: -1, // Sempre serve stale e revalida em background
    // Usa storage 'cache' (Cloudflare KV)
    base: 'cache',
    // Grupo para organização
    group: 'suggestions',
    // Chave única: v2:{uf}:{termo_normalizado}
    // v2: cache 3 meses, limite 500 (corrigido)
    getKey: (event) => {
      const query = getQuery(event)
      const termo = (query.termo as string)?.trim().toLowerCase() || ''
      const uf = (query.uf as string)?.toUpperCase() || 'all'
      return `v2:${uf}:${termo}`
    },
    // Stale-while-revalidate
    swr: true,
  },
)

/**
 * Interface do candidato para busca
 */
interface CandidatoBusca {
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

/**
 * Agrupa resultados por candidato para somar votos de diferentes zonas
 * Ordenado por votos (desc), limitado a 15 resultados
 */
function aggregateCandidatos(rawData: Record<string, unknown>[]): CandidatoBusca[] {
  const grouped = new Map<string, CandidatoBusca>()

  for (const d of rawData) {
    // Chave única: nome + ano + cargo + uf + turno
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

  // Ordena por votos (desc) e limita a 15
  return Array.from(grouped.values())
    .sort((a, b) => b.qt_votos_nominais - a.qt_votos_nominais)
    .slice(0, 15)
}
