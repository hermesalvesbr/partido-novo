/**
 * API endpoint para buscar dados de candidato
 * Usa a view materializada mv_votos_candidato para resposta ultra-rápida
 *
 * A mv_votos_candidato já tem os dados agregados por candidato/eleição
 * com índice otimizado para busca por UF + nome de urna
 */

interface VotosCandidatoRecord {
  sq_candidato: number
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  nm_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  nr_turno: number
  ds_sit_tot_turno: string
  total_votos: number
  municipios_votados: number
  zonas_contadas: number
}

interface EleicaoAgregada {
  ano_eleicao: number
  ds_cargo: string
  sg_partido: string
  nr_turno: number
  ds_sit_tot_turno: string
  total_votos: number
  municipios_count: number
}

interface CandidatoResponse {
  nm_candidato: string
  nm_urna_candidato: string
  sg_uf: string
  eleicoes: EleicaoAgregada[]
  municipiosRanking: { nm_municipio: string, total_votos: number, percentual: number }[]
  stats: {
    total_votos: number
    anos_ativo: number[]
    partidos: string[]
    cargos: string[]
    vitorias: number
    derrotas: number
  }
}

/**
 * Converte texto para slug URL-friendly (mantido para uso futuro)
 */
function _slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

/**
 * Extrai palavras distintivas do slug para busca
 * Pega a primeira palavra (nome) e a penúltima (sobrenome de urna comum)
 */
function extrairPalavrasBusca(nomeSlug: string): string[] {
  const partes = nomeSlug.split('-')
  const distintivas = partes.filter(p => p.length >= 4)

  if (distintivas.length === 0)
    return []
  if (distintivas.length === 1)
    return [distintivas[0]!.toUpperCase()]

  // Primeira palavra (nome) + penúltima ou última (sobrenome de urna)
  const primeira = distintivas[0]!.toUpperCase()
  const ultima = distintivas[distintivas.length - 2]?.toUpperCase() || distintivas[distintivas.length - 1]!.toUpperCase()

  return [primeira, ultima]
}

// Cache server-side com Nitro (1 hora) - SWR para resposta rápida
export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const slug = query.slug as string

  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Parâmetro slug é obrigatório',
    })
  }

  // Parse do slug: uf-nome-slug
  const parts = slug.split('-')
  if (parts.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Formato de slug inválido',
    })
  }

  const uf = parts[0]!.toUpperCase()
  const nomeSlug = parts.slice(1).join('-')
  const palavrasBusca = extrairPalavrasBusca(nomeSlug)

  if (palavrasBusca.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Nome do candidato muito curto',
    })
  }

  const config = useRuntimeConfig()
  const postgrestUrl = config.public.postgrestUrl as string

  // Buscar na view materializada mv_votos_candidato (ultra-rápido!)
  const searchTerm = palavrasBusca.join(' ')
  const urlStr = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_urna_candidato=ilike.*${encodeURIComponent(searchTerm)}*&order=ano_eleicao.desc`

  const response = await fetch(urlStr)

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      message: `Erro PostgREST: ${response.statusText}`,
    })
  }

  const records = await response.json() as VotosCandidatoRecord[]

  if (records.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Candidato não encontrado',
    })
  }

  // A view mv_votos_candidato já agrupa por candidato corretamente
  return buildResponse(records, uf)
}, {
  maxAge: 60 * 60, // 1 hora
  getKey: (event) => {
    const query = getQuery(event)
    // v2: usando mv_votos_candidato com busca por nome de urna
    return `candidato:v2:${query.slug || 'unknown'}`
  },
  swr: true, // Stale-while-revalidate para resposta instantânea
})

function buildResponse(records: VotosCandidatoRecord[], uf: string): CandidatoResponse {
  const firstRecord = records[0]!

  // Converte para formato de eleições
  const eleicoes: EleicaoAgregada[] = records.map(r => ({
    ano_eleicao: r.ano_eleicao,
    ds_cargo: r.ds_cargo,
    sg_partido: r.sg_partido,
    nr_turno: r.nr_turno,
    ds_sit_tot_turno: r.ds_sit_tot_turno,
    total_votos: r.total_votos,
    municipios_count: r.municipios_votados,
  })).sort((a, b) => b.ano_eleicao - a.ano_eleicao)

  // Estatísticas
  const totalVotos = eleicoes.reduce((acc, e) => acc + e.total_votos, 0)
  const anosAtivo = [...new Set(eleicoes.map(e => e.ano_eleicao))]
  const partidosUsados = [...new Set(eleicoes.map(e => e.sg_partido))]
  const cargosDisputados = [...new Set(eleicoes.map(e => e.ds_cargo))]
  const vitorias = eleicoes.filter(e =>
    e.ds_sit_tot_turno.toUpperCase().includes('ELEITO')
    && !e.ds_sit_tot_turno.toUpperCase().includes('NÃO ELEITO'),
  ).length

  return {
    nm_candidato: firstRecord.nm_candidato,
    nm_urna_candidato: firstRecord.nm_urna_candidato,
    sg_uf: uf,
    eleicoes,
    municipiosRanking: [], // Não disponível na view agregada
    stats: {
      total_votos: totalVotos,
      anos_ativo: anosAtivo,
      partidos: partidosUsados,
      cargos: cargosDisputados,
      vitorias,
      derrotas: eleicoes.length - vitorias,
    },
  }
}
