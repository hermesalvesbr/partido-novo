/**
 * API endpoint para buscar dados de candidato
 * Usa a view materializada mv_votos_candidato para resposta ultra-rápida
 *
 * A mv_votos_candidato já tem os dados agregados por candidato/eleição
 * com índice otimizado para busca por UF + nome de urna
 */

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
  /** ranking de municípios de cada eleição (1º turno), para a página filtrada por ano */
  municipiosPorAno: Record<string, { nm_municipio: string, total_votos: number, percentual: number }[]>
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
  /** municípios com pelo menos 1 voto, por `${sq_candidato}|${nr_turno}` */
  municipiosComVoto: Map<string, number>
  /** votos por município em cada ano (1º turno) */
  porAno: Map<number, Map<string, number>>
  debug?: any
}

// Cache server-side com Nitro (1 hora) - SWR para resposta rápida
export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const config = useRuntimeConfig()
  const postgrestUrl = config.public.postgrestUrl as string
  const { uf, records } = await buscarCandidatoPorSlug(query.slug as string | undefined, postgrestUrl)

  // A view mv_votos_candidato já agrupa por candidato corretamente

  // Buscar ranking de municípios (agora necessário para o componente Geografia)
  const sqCandidatos = records.map(r => r.sq_candidato).filter(Boolean)

  // Reverted to Fetch PostgREST because direct SQL is failing in this env
  const { entries: municipiosRanking, municipiosComVoto, porAno } = await fetchMunicipiosRanking(postgrestUrl, sqCandidatos, uf)

  // Calcular percentual. Só 1º turno: somar o 2º contaria o mesmo eleitor duas vezes
  const totalVotosGeral = records.filter(r => r.nr_turno === 1).reduce((acc, r) => acc + r.total_votos, 0)

  const rankingComPercentual = municipiosRanking.map(m => ({
    ...m,
    percentual: totalVotosGeral > 0 ? (m.total_votos / totalVotosGeral) * 100 : 0,
  }))

  const municipiosPorAno: CandidatoResponse['municipiosPorAno'] = {}
  for (const [ano, mapa] of porAno) {
    const totalAno = [...mapa.values()].reduce((a, v) => a + v, 0)
    municipiosPorAno[ano] = [...mapa]
      .map(([nm_municipio, total_votos]) => ({ nm_municipio, total_votos, percentual: totalAno > 0 ? (total_votos / totalAno) * 100 : 0 }))
      .sort((a, b) => b.total_votos - a.total_votos)
  }

  return buildResponse(records, uf, rankingComPercentual, municipiosComVoto, municipiosPorAno)
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
    // v17: ranking por ano e só 1º turno (v16: só a UF da página; v15: só voto > 0; v14: slug estrito)
    return `v17:${query.slug || 'unknown'}`
  },
  // Stale-while-revalidate para resposta instantânea
  swr: true,
  // NOTA: Erros (throw createError) NÃO são cacheados pelo Nitro automaticamente
  // Apenas respostas de sucesso (return) são persistidas no KV
})

async function fetchMunicipiosRanking(baseUrl: string, sqCandidatos: number[], uf: string): Promise<RankingResult> {
  const debugInfo: any = { sqCandidatos, method: 'fetch-postgrest' }
  const municipiosComVoto = new Map<string, number>()
  const porAno = new Map<number, Map<string, number>>()
  if (sqCandidatos.length === 0)
    return { entries: [], municipiosComVoto, porAno, debug: debugInfo }

  try {
    const idsStr = sqCandidatos.join(',')
    // Só linhas com voto: o TSE lista todo candidato em todo município do estado,
    // inclusive com 0 voto (em eleição geral, ~60% das linhas). Sem o filtro, o
    // ranking trazia municípios zerados e o histórico dizia "185 municípios".
    // Note: sorting by qt_votos_nominais desc at DB level
    // sg_uf: o sq de presidente é nacional; sem o filtro, a página "pe-..." do
    // Lula listava os 5.425 municípios do Brasil
    const url = `${baseUrl}/votacao_candidato_munzona?sq_candidato=in.(${idsStr})&sg_uf=eq.${uf}&qt_votos_nominais=gt.0&select=sq_candidato,ano_eleicao,nr_turno,nm_municipio,qt_votos_nominais&order=qt_votos_nominais.desc`

    debugInfo.url = url

    const response = await fetch(url)
    debugInfo.status = response.status

    if (!response.ok) {
      debugInfo.errorText = await response.text()
      console.error('PostgREST error fetching ranking:', debugInfo.errorText)
      return { entries: [], municipiosComVoto, porAno, debug: debugInfo }
    }

    const data = await response.json() as { sq_candidato: number, ano_eleicao: number, nr_turno: number, nm_municipio: string, qt_votos_nominais: number }[]
    debugInfo.dataLength = data.length

    // Aggregate by municipality (client-side aggregation)
    const mapa = new Map<string, number>()
    const porEleicao = new Map<string, Set<string>>()

    for (const item of data) {
      const chave = `${item.sq_candidato}|${item.nr_turno}`
      porEleicao.set(chave, (porEleicao.get(chave) ?? new Set()).add(item.nm_municipio))
      // Ranking só do 1º turno: somar o 2º contaria o mesmo eleitor duas vezes
      if (item.nr_turno !== 1)
        continue
      mapa.set(item.nm_municipio, (mapa.get(item.nm_municipio) || 0) + item.qt_votos_nominais)
      const doAno = porAno.get(item.ano_eleicao) ?? new Map<string, number>()
      doAno.set(item.nm_municipio, (doAno.get(item.nm_municipio) || 0) + item.qt_votos_nominais)
      porAno.set(item.ano_eleicao, doAno)
    }
    for (const [chave, municipios] of porEleicao)
      municipiosComVoto.set(chave, municipios.size)

    const entries = Array.from(mapa.entries())
      .map(([nm_municipio, total_votos]) => ({ nm_municipio, total_votos }))
      .sort((a, b) => b.total_votos - a.total_votos)

    debugInfo.aggregatedCount = entries.length

    return { entries, municipiosComVoto, porAno, debug: debugInfo }
  }
  catch (e: any) {
    debugInfo.error = e.message || String(e)
    console.error('Fetch error:', e)
    return { entries: [], municipiosComVoto, porAno, debug: debugInfo }
  }
}

function buildResponse(
  records: VotosCandidatoRecord[],
  uf: string,
  municipiosRanking: { nm_municipio: string, total_votos: number, percentual: number }[],
  municipiosComVoto: Map<string, number>,
  municipiosPorAno: CandidatoResponse['municipiosPorAno'],
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
    // mv_votos_candidato.municipios_votados conta também municípios com 0 voto
    municipios_count: municipiosComVoto.get(`${r.sq_candidato}|${r.nr_turno}`) ?? 0,
  })).sort((a, b) => b.ano_eleicao - a.ano_eleicao)

  // Estatísticas
  // Só 1º turno: somar o 2º contaria o mesmo eleitor duas vezes
  const totalVotos = eleicoes.filter(e => e.nr_turno === 1).reduce((acc, e) => acc + e.total_votos, 0)
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
    municipiosPorAno,
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
