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
  debug?: any
}

interface RankingResult {
  entries: { nm_municipio: string, total_votos: number }[]
  debug?: any
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

  // Reconstruir nome completo do slug para buscar por nm_candidato
  // pe-nunes-rafael-mendes-coelho -> NUNES RAFAEL MENDES COELHO
  const nomeCompleto = nomeSlug.toUpperCase().replace(/-/g, ' ')

  const config = useRuntimeConfig()
  const postgrestUrl = config.public.postgrestUrl as string

  // Estratégia 1: Usar RPC com normalize_search (ignora acentos)
  // Isso permite encontrar "ANDRÉ" quando o slug é "andre"
  let urlStr = `${postgrestUrl}/rpc/buscar_candidato_por_slug?p_uf=${uf}&p_nome_slug=${encodeURIComponent(nomeCompleto)}`

  let response = await fetch(urlStr)
  let records: VotosCandidatoRecord[] = []

  if (response.ok) {
    records = await response.json() as VotosCandidatoRecord[]
  }

  // Estratégia 2: Fallback para ILIKE se RPC falhar ou não existir
  if (records.length === 0) {
    urlStr = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_candidato=ilike.*${encodeURIComponent(nomeCompleto)}*&order=ano_eleicao.desc`
    response = await fetch(urlStr)
    if (response.ok) {
      records = await response.json() as VotosCandidatoRecord[]
    }
  }

  // Estratégia 3: Se não encontrou, tentar por nome de urna com palavras-chave
  if (records.length === 0) {
    const palavrasBusca = extrairPalavrasBusca(nomeSlug)
    if (palavrasBusca.length > 0) {
      const searchTerm = palavrasBusca.join(' ')
      urlStr = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_urna_candidato=ilike.*${encodeURIComponent(searchTerm)}*&order=ano_eleicao.desc`

      response = await fetch(urlStr)
      if (response.ok) {
        records = await response.json() as VotosCandidatoRecord[]
      }
    }
  }

  // Estratégia 3: Tentar busca parcial pelo primeiro e último nome
  if (records.length === 0) {
    const partes = nomeCompleto.split(' ').filter(p => p.length >= 3)
    if (partes.length >= 2) {
      const primeiro = partes[0]
      const ultimo = partes[partes.length - 1]
      urlStr = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_candidato=ilike.*${encodeURIComponent(primeiro!)}*${encodeURIComponent(ultimo!)}*&order=ano_eleicao.desc`

      response = await fetch(urlStr)
      if (response.ok) {
        records = await response.json() as VotosCandidatoRecord[]
      }
    }
  }

  if (records.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Candidato não encontrado',
    })
  }

  // A view mv_votos_candidato já agrupa por candidato corretamente

  // Buscar ranking de municípios (agora necessário para o componente Geografia)
  const sqCandidatos = records.map(r => r.sq_candidato).filter(Boolean)

  // Reverted to Fetch PostgREST because direct SQL is failing in this env
  const { entries: municipiosRanking } = await fetchMunicipiosRanking(postgrestUrl, sqCandidatos)

  // Calcular percentual
  const totalVotosGeral = records.reduce((acc, r) => acc + r.total_votos, 0)

  const rankingComPercentual = municipiosRanking.map(m => ({
    ...m,
    percentual: totalVotosGeral > 0 ? (m.total_votos / totalVotosGeral) * 100 : 0,
  }))

  return buildResponse(records, uf, rankingComPercentual)
}, {
  // Cache de 1 ano no Cloudflare KV (dados eleitorais são imutáveis após eleição)
  maxAge: 60 * 60 * 24 * 365, // 1 ano
  // Serve stale indefinidamente enquanto revalida em background
  staleMaxAge: -1, // -1 = sempre serve stale e revalida em background
  // Usa o storage 'cache' configurado no nuxt.config.ts (Cloudflare KV)
  base: 'cache',
  // Nome do grupo para organização no KV
  group: 'candidato',
  // Chave única por slug
  getKey: (event) => {
    const query = getQuery(event)
    // v13: cache 1 ano no Cloudflare KV
    return `v13:${query.slug || 'unknown'}`
  },
  // Stale-while-revalidate para resposta instantânea
  swr: true,
  // NOTA: Erros (throw createError) NÃO são cacheados pelo Nitro automaticamente
  // Apenas respostas de sucesso (return) são persistidas no KV
})

async function fetchMunicipiosRanking(baseUrl: string, sqCandidatos: number[]): Promise<RankingResult> {
  const debugInfo: any = { sqCandidatos, method: 'fetch-postgrest' }
  if (sqCandidatos.length === 0)
    return { entries: [], debug: debugInfo }

  try {
    const idsStr = sqCandidatos.join(',')
    // Note: sorting by qt_votos_nominais desc at DB level
    const url = `${baseUrl}/votacao_candidato_munzona?sq_candidato=in.(${idsStr})&select=nm_municipio,qt_votos_nominais&order=qt_votos_nominais.desc`

    debugInfo.url = url

    const response = await fetch(url)
    debugInfo.status = response.status

    if (!response.ok) {
      debugInfo.errorText = await response.text()
      console.error('PostgREST error fetching ranking:', debugInfo.errorText)
      return { entries: [], debug: debugInfo }
    }

    const data = await response.json() as { nm_municipio: string, qt_votos_nominais: number }[]
    debugInfo.dataLength = data.length

    // Aggregate by municipality (client-side aggregation)
    const mapa = new Map<string, number>()

    for (const item of data) {
      const atual = mapa.get(item.nm_municipio) || 0
      mapa.set(item.nm_municipio, atual + item.qt_votos_nominais)
    }

    const entries = Array.from(mapa.entries())
      .map(([nm_municipio, total_votos]) => ({ nm_municipio, total_votos }))
      .sort((a, b) => b.total_votos - a.total_votos)

    debugInfo.aggregatedCount = entries.length

    return { entries, debug: debugInfo }
  }
  catch (e: any) {
    debugInfo.error = e.message || String(e)
    console.error('Fetch error:', e)
    return { entries: [], debug: debugInfo }
  }
}

function buildResponse(
  records: VotosCandidatoRecord[],
  uf: string,
  municipiosRanking: { nm_municipio: string, total_votos: number, percentual: number }[],
): CandidatoResponse {
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
    municipiosRanking,
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
