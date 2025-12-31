/**
 * API de Análise Eleitoral Inteligente
 *
 * Lógica:
 * 1. Conta eleitos = número de vagas
 * 2. Bloco de corte = eleitos + 5-10 não eleitos (poder real)
 * 3. Concorrente interno = mesmo partido, mais votos, mais próximo
 * 4. Concorrente externo primário = pior eleito de outro partido
 * 5. Score de oportunidade = votos do pior eleito - votos do candidato
 */

// Tipos para a análise
interface CandidatoBloco {
  nm_urna_candidato: string
  nm_candidato: string
  sg_partido: string
  sg_uf: string
  total_votos: number
  ds_sit_tot_turno: string
  eleito: boolean
  posicao: number
  sq_candidato: number
  slug: string
}

interface ConcorrenteInterno {
  nm_urna_candidato: string
  sg_partido: string
  sg_uf: string
  slug: string
  total_votos: number
  diferenca_votos: number
  posicao: number
  eleito: boolean
}

interface ConcorrenteExterno {
  nm_urna_candidato: string
  sg_partido: string
  sg_uf: string
  slug: string
  total_votos: number
  diferenca_votos: number
  posicao: number
  tipo: 'pior_eleito' | 'proximo_acima' | 'proximo_abaixo'
  score_oportunidade: number
}

interface PartidoEficiencia {
  sg_partido: string
  candidatos_bloco: number
  total_votos: number
  eleitos: number
  media_votos: number
  eficiencia: number // eleitos / candidatos_bloco
}

interface AnaliseEleicao {
  ano_eleicao: number
  nm_municipio: string
  sg_uf: string
  ds_cargo: string
  nr_turno: number
  // Dados do candidato analisado
  candidato: {
    nm_urna_candidato: string
    sg_partido: string
    total_votos: number
    posicao: number
    eleito: boolean
    no_bloco_corte: boolean
  }
  // Métricas do pleito
  metricas: {
    total_candidatos: number
    vagas: number // = total de eleitos
    bloco_corte_tamanho: number // vagas * 1.5
    votos_corte: number // menor voto entre eleitos
    votos_ultimo_bloco: number // menor voto no bloco de corte
  }
  // Concorrentes
  concorrente_interno: ConcorrenteInterno | null
  concorrente_externo: ConcorrenteExterno | null
  pior_eleito_externo: ConcorrenteExterno | null
  // Análise de partidos
  partidos_eficiencia: PartidoEficiencia[]
  // Bloco de corte completo
  bloco_corte: CandidatoBloco[]
}

interface AnaliseResponse {
  analises: AnaliseEleicao[]
  resumo: {
    total_eleicoes: number
    vezes_no_bloco: number
    oportunidades_reais: number // score < 500 votos
  }
}

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
  const nomeCompleto = nomeSlug.toUpperCase().replace(/-/g, ' ')

  const config = useRuntimeConfig()
  const postgrestUrl = config.public.postgrestUrl as string

  // 1. Buscar dados do candidato
  let candidatoUrl = `${postgrestUrl}/rpc/buscar_candidato_por_slug?p_uf=${uf}&p_nome_slug=${encodeURIComponent(nomeCompleto)}`
  let response = await fetch(candidatoUrl)
  let candidatoRecords: {
    sq_candidato: number
    nm_urna_candidato: string
    nm_candidato: string
    sg_partido: string
  }[] = []

  if (response.ok) {
    candidatoRecords = await response.json()
  }

  // Fallback: busca por ILIKE
  if (candidatoRecords.length === 0) {
    candidatoUrl = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_candidato=ilike.*${encodeURIComponent(nomeCompleto)}*&select=sq_candidato,nm_urna_candidato,nm_candidato,sg_partido&limit=10`
    response = await fetch(candidatoUrl)
    if (response.ok) {
      candidatoRecords = await response.json()
    }
  }

  if (candidatoRecords.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Candidato não encontrado',
    })
  }

  const sqCandidatos = candidatoRecords.map(c => c.sq_candidato)
  const partidoCandidato = candidatoRecords[0]?.sg_partido || ''
  const nomeUrnaCandidato = candidatoRecords[0]?.nm_urna_candidato || ''

  // 2. Buscar todas as votações do candidato (por município/ano/cargo/turno)
  const votacaoUrl = `${postgrestUrl}/votacao_candidato_munzona?sq_candidato=in.(${sqCandidatos.join(',')})&select=nm_municipio,sg_uf,ano_eleicao,ds_cargo,nr_turno,sg_partido,qt_votos_nominais,ds_sit_tot_turno&order=ano_eleicao.desc`

  response = await fetch(votacaoUrl)
  if (!response.ok) {
    throw createError({
      statusCode: 500,
      message: 'Erro ao buscar votação do candidato',
    })
  }

  const votacaoData = await response.json() as {
    nm_municipio: string
    sg_uf: string
    ano_eleicao: number
    ds_cargo: string
    nr_turno: number
    sg_partido: string
    qt_votos_nominais: number
    ds_sit_tot_turno: string
  }[]

  // Cargos estaduais vs municipais
  const cargosEstaduais = ['DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL', 'SENADOR', 'GOVERNADOR', 'PRESIDENTE']

  // Agregar votos do candidato por eleição
  // Para cargos estaduais: agrupa por UF
  // Para cargos municipais: agrupa por município
  const eleicoesMap = new Map<string, {
    nm_municipio: string
    sg_uf: string
    ano_eleicao: number
    ds_cargo: string
    nr_turno: number
    sg_partido: string
    total_votos: number
    ds_sit_tot_turno: string
    is_estadual: boolean
  }>()

  for (const v of votacaoData) {
    const isEstadual = cargosEstaduais.some(c => v.ds_cargo.toUpperCase().includes(c))
    // Para estadual: agrupa por UF/ano/cargo/turno
    // Para municipal: agrupa por município/ano/cargo/turno
    const key = isEstadual
      ? `${v.sg_uf}|${v.ano_eleicao}|${v.ds_cargo}|${v.nr_turno}`
      : `${v.nm_municipio}|${v.ano_eleicao}|${v.ds_cargo}|${v.nr_turno}`
    const existing = eleicoesMap.get(key)
    if (existing) {
      existing.total_votos += v.qt_votos_nominais
    }
    else {
      eleicoesMap.set(key, {
        nm_municipio: isEstadual ? v.sg_uf : v.nm_municipio, // Para estadual, usa UF como "município"
        sg_uf: v.sg_uf,
        ano_eleicao: v.ano_eleicao,
        ds_cargo: v.ds_cargo,
        nr_turno: v.nr_turno,
        sg_partido: v.sg_partido,
        total_votos: v.qt_votos_nominais,
        ds_sit_tot_turno: v.ds_sit_tot_turno,
        is_estadual: isEstadual,
      })
    }
  }

  // Pegar as eleições mais relevantes (maior votação por ano)
  const eleicoesPorAno = new Map<number, typeof eleicoesMap extends Map<string, infer V> ? V : never>()
  for (const eleicao of eleicoesMap.values()) {
    const existing = eleicoesPorAno.get(eleicao.ano_eleicao)
    if (!existing || eleicao.total_votos > existing.total_votos) {
      eleicoesPorAno.set(eleicao.ano_eleicao, eleicao)
    }
  }

  const eleicoesAnalise = Array.from(eleicoesPorAno.values())
    .sort((a, b) => b.ano_eleicao - a.ano_eleicao)
    .slice(0, 4) // Últimas 4 eleições

  // 3. Para cada eleição, fazer análise completa
  const analises: AnaliseEleicao[] = []

  for (const eleicao of eleicoesAnalise) {
    const analise = await analisarEleicao(
      postgrestUrl,
      eleicao,
      sqCandidatos,
      partidoCandidato,
      nomeUrnaCandidato,
      uf,
    )
    if (analise) {
      analises.push(analise)
    }
  }

  // Calcular resumo
  const vezesNoBloco = analises.filter(a => a.candidato.no_bloco_corte).length
  const oportunidadesReais = analises.filter(a =>
    a.pior_eleito_externo && a.pior_eleito_externo.score_oportunidade < 500,
  ).length

  return {
    analises,
    resumo: {
      total_eleicoes: analises.length,
      vezes_no_bloco: vezesNoBloco,
      oportunidades_reais: oportunidadesReais,
    },
  } as AnaliseResponse
}, {
  maxAge: 60 * 60 * 24 * 365, // 1 ano
  staleMaxAge: -1,
  base: 'cache',
  group: 'analise-eleitoral',
  getKey: (event) => {
    const query = getQuery(event)
    return `v4:${query.slug || 'unknown'}`
  },
  swr: true,
})

function gerarSlug(uf: string, nomeUrna: string): string {
  return `${uf.toLowerCase()}-${nomeUrna.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/-{2,}/g, '-')}`
}

async function analisarEleicao(
  postgrestUrl: string,
  eleicao: {
    nm_municipio: string
    sg_uf: string
    ano_eleicao: number
    ds_cargo: string
    nr_turno: number
    sg_partido: string
    total_votos: number
    ds_sit_tot_turno: string
    is_estadual: boolean
  },
  sqCandidatos: number[],
  partidoCandidato: string,
  _nomeUrnaCandidato: string,
  uf: string,
): Promise<AnaliseEleicao | null> {
  // Para eleições estaduais: busca por UF
  // Para eleições municipais: busca por município
  let todosUrl: string
  if (eleicao.is_estadual) {
    todosUrl = `${postgrestUrl}/votacao_candidato_munzona?sg_uf=eq.${eleicao.sg_uf}&ano_eleicao=eq.${eleicao.ano_eleicao}&ds_cargo=eq.${encodeURIComponent(eleicao.ds_cargo)}&nr_turno=eq.${eleicao.nr_turno}&select=sq_candidato,nm_urna_candidato,nm_candidato,sg_partido,qt_votos_nominais,ds_sit_tot_turno`
  }
  else {
    todosUrl = `${postgrestUrl}/votacao_candidato_munzona?nm_municipio=eq.${encodeURIComponent(eleicao.nm_municipio)}&ano_eleicao=eq.${eleicao.ano_eleicao}&ds_cargo=eq.${encodeURIComponent(eleicao.ds_cargo)}&nr_turno=eq.${eleicao.nr_turno}&select=sq_candidato,nm_urna_candidato,nm_candidato,sg_partido,qt_votos_nominais,ds_sit_tot_turno`
  }

  const response = await fetch(todosUrl)
  if (!response.ok)
    return null

  const todosData = await response.json() as {
    sq_candidato: number
    nm_urna_candidato: string
    nm_candidato: string
    sg_partido: string
    qt_votos_nominais: number
    ds_sit_tot_turno: string
  }[]

  // Agregar votos por candidato (pode ter múltiplas zonas)
  const candidatosMap = new Map<number, {
    sq_candidato: number
    nm_urna_candidato: string
    nm_candidato: string
    sg_partido: string
    total_votos: number
    ds_sit_tot_turno: string
  }>()

  for (const c of todosData) {
    const existing = candidatosMap.get(c.sq_candidato)
    if (existing) {
      existing.total_votos += c.qt_votos_nominais
    }
    else {
      candidatosMap.set(c.sq_candidato, {
        sq_candidato: c.sq_candidato,
        nm_urna_candidato: c.nm_urna_candidato,
        nm_candidato: c.nm_candidato,
        sg_partido: c.sg_partido,
        total_votos: c.qt_votos_nominais,
        ds_sit_tot_turno: c.ds_sit_tot_turno,
      })
    }
  }

  // Ordenar por votos (maior para menor)
  const candidatosOrdenados = Array.from(candidatosMap.values())
    .sort((a, b) => b.total_votos - a.total_votos)

  if (candidatosOrdenados.length === 0)
    return null

  // Determinar quem foi eleito
  const isEleito = (sit: string) => {
    const upper = sit.toUpperCase()
    return (upper.includes('ELEITO') || upper.includes('MÉDIA') || upper.includes('QP'))
      && !upper.includes('NÃO ELEITO')
  }

  // Adicionar posição e flag eleito
  const candidatosComPosicao: CandidatoBloco[] = candidatosOrdenados.map((c, index) => ({
    nm_urna_candidato: c.nm_urna_candidato,
    nm_candidato: c.nm_candidato,
    sg_partido: c.sg_partido,
    sg_uf: uf,
    total_votos: c.total_votos,
    ds_sit_tot_turno: c.ds_sit_tot_turno,
    eleito: isEleito(c.ds_sit_tot_turno),
    posicao: index + 1,
    sq_candidato: c.sq_candidato,
    slug: gerarSlug(uf, c.nm_candidato),
  }))

  // Contar vagas (= total de eleitos)
  const vagas = candidatosComPosicao.filter(c => c.eleito).length

  if (vagas === 0) {
    // Eleição sem eleitos (dados incompletos ou 2º turno de majoritária)
    return null
  }

  // Calcular tamanho do bloco de corte (1.5x vagas, mínimo vagas + 5)
  const blocoCorteTamanho = Math.max(Math.ceil(vagas * 1.5), vagas + 5)

  // Bloco de corte = top N candidatos
  const blocoCorte = candidatosComPosicao.slice(0, blocoCorteTamanho)

  // Encontrar o candidato analisado
  const candidatoAnalisado = candidatosComPosicao.find(c =>
    sqCandidatos.includes(c.sq_candidato),
  )

  if (!candidatoAnalisado) {
    // Candidato não encontrado nesta eleição específica
    return null
  }

  // Métricas
  const votosCorte = candidatosComPosicao.filter(c => c.eleito).at(-1)?.total_votos || 0
  const votosUltimoBloco = blocoCorte.at(-1)?.total_votos || 0

  // CONCORRENTE INTERNO: mesmo partido, mais votos, mais próximo
  const mesmoPartido = candidatosComPosicao.filter(c =>
    c.sg_partido === partidoCandidato
    && c.total_votos > candidatoAnalisado.total_votos,
  )
  const concorrenteInterno: ConcorrenteInterno | null = mesmoPartido.length > 0
    ? {
        nm_urna_candidato: mesmoPartido.at(-1)!.nm_urna_candidato,
        sg_partido: mesmoPartido.at(-1)!.sg_partido,
        sg_uf: uf,
        slug: gerarSlug(uf, mesmoPartido.at(-1)!.nm_candidato),
        total_votos: mesmoPartido.at(-1)!.total_votos,
        diferenca_votos: mesmoPartido.at(-1)!.total_votos - candidatoAnalisado.total_votos,
        posicao: mesmoPartido.at(-1)!.posicao,
        eleito: mesmoPartido.at(-1)!.eleito,
      }
    : null

  // CONCORRENTE EXTERNO: outro partido, mais próximo em votos (acima)
  const outrosPartidos = candidatosComPosicao.filter(c =>
    c.sg_partido !== partidoCandidato
    && c.total_votos > candidatoAnalisado.total_votos,
  )
  const proximoAcima = outrosPartidos.at(-1)
  const concorrenteExterno: ConcorrenteExterno | null = proximoAcima
    ? {
        nm_urna_candidato: proximoAcima.nm_urna_candidato,
        sg_partido: proximoAcima.sg_partido,
        sg_uf: uf,
        slug: gerarSlug(uf, proximoAcima.nm_candidato),
        total_votos: proximoAcima.total_votos,
        diferenca_votos: proximoAcima.total_votos - candidatoAnalisado.total_votos,
        posicao: proximoAcima.posicao,
        tipo: 'proximo_acima',
        score_oportunidade: proximoAcima.total_votos - candidatoAnalisado.total_votos,
      }
    : null

  // PIOR ELEITO EXTERNO: eleito de outro partido com MENOR votação
  const eleitosExternos = candidatosComPosicao.filter(c =>
    c.eleito && c.sg_partido !== partidoCandidato,
  )
  const piorEleitoExt = eleitosExternos.at(-1) // último = menor votação entre eleitos
  const piorEleitoExterno: ConcorrenteExterno | null = piorEleitoExt
    ? {
        nm_urna_candidato: piorEleitoExt.nm_urna_candidato,
        sg_partido: piorEleitoExt.sg_partido,
        sg_uf: uf,
        slug: gerarSlug(uf, piorEleitoExt.nm_candidato),
        total_votos: piorEleitoExt.total_votos,
        diferenca_votos: piorEleitoExt.total_votos - candidatoAnalisado.total_votos,
        posicao: piorEleitoExt.posicao,
        tipo: 'pior_eleito',
        score_oportunidade: piorEleitoExt.total_votos - candidatoAnalisado.total_votos,
      }
    : null

  // ANÁLISE DE PARTIDOS NO BLOCO
  const partidosNoBloco = new Map<string, {
    candidatos: number
    votos: number
    eleitos: number
  }>()

  for (const c of blocoCorte) {
    const existing = partidosNoBloco.get(c.sg_partido)
    if (existing) {
      existing.candidatos++
      existing.votos += c.total_votos
      if (c.eleito)
        existing.eleitos++
    }
    else {
      partidosNoBloco.set(c.sg_partido, {
        candidatos: 1,
        votos: c.total_votos,
        eleitos: c.eleito ? 1 : 0,
      })
    }
  }

  const partidosEficiencia: PartidoEficiencia[] = Array.from(partidosNoBloco.entries())
    .map(([partido, dados]) => ({
      sg_partido: partido,
      candidatos_bloco: dados.candidatos,
      total_votos: dados.votos,
      eleitos: dados.eleitos,
      media_votos: Math.round(dados.votos / dados.candidatos),
      eficiencia: dados.candidatos > 0 ? dados.eleitos / dados.candidatos : 0,
    }))
    .sort((a, b) => b.eficiencia - a.eficiencia)

  return {
    ano_eleicao: eleicao.ano_eleicao,
    nm_municipio: eleicao.nm_municipio,
    sg_uf: uf,
    ds_cargo: eleicao.ds_cargo,
    nr_turno: eleicao.nr_turno,
    candidato: {
      nm_urna_candidato: candidatoAnalisado.nm_urna_candidato,
      sg_partido: candidatoAnalisado.sg_partido,
      total_votos: candidatoAnalisado.total_votos,
      posicao: candidatoAnalisado.posicao,
      eleito: candidatoAnalisado.eleito,
      no_bloco_corte: candidatoAnalisado.posicao <= blocoCorteTamanho,
    },
    metricas: {
      total_candidatos: candidatosComPosicao.length,
      vagas,
      bloco_corte_tamanho: blocoCorteTamanho,
      votos_corte: votosCorte,
      votos_ultimo_bloco: votosUltimoBloco,
    },
    concorrente_interno: concorrenteInterno,
    concorrente_externo: concorrenteExterno,
    pior_eleito_externo: piorEleitoExterno,
    partidos_eficiencia: partidosEficiencia,
    bloco_corte: blocoCorte,
  }
}
