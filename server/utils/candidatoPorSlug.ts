/**
 * Localiza as eleições de um candidato a partir do slug da URL (uf-nome-slug).
 * Usado por /api/candidato e /api/candidato-locais.
 */

export interface VotosCandidatoRecord {
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

/**
 * Converte texto para slug URL-friendly (mesma regra de app/utils/slug.ts)
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
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

/**
 * Valida o slug e devolve a UF e os registros de mv_votos_candidato do candidato.
 * Lança 400 para slug mal formado e 404 se nenhum registro bater exatamente.
 */
export async function buscarCandidatoPorSlug(slug: string | undefined, postgrestUrl: string): Promise<{ uf: string, records: VotosCandidatoRecord[] }> {
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

  // Estratégia 1: Usar RPC com normalize_search (ignora acentos)
  // Isso permite encontrar "ANDRÉ" quando o slug é "andre"
  let urlStr = `${postgrestUrl}/rpc/buscar_candidato_por_slug?p_uf=${uf}&p_nome_slug=${encodeURIComponent(nomeCompleto)}`

  let response = await fetch(urlStr)
  let records: VotosCandidatoRecord[] = []

  if (response.ok) {
    records = await response.json() as VotosCandidatoRecord[]
  }

  // As estratégias abaixo são buscas aproximadas e podem trazer outra pessoa
  // ("pe-jose-renan-bihum-de-alencar" chegou a abrir o CAPITAO ALENCAR pelo
  // primeiro e último nome). Só vale o registro cujo slug do nome completo ou
  // do nome de urna é exatamente o da URL; se nenhum bater, é 404.
  const confere = (r: VotosCandidatoRecord) =>
    slugify(r.nm_candidato ?? '') === nomeSlug || slugify(r.nm_urna_candidato ?? '') === nomeSlug

  // Estratégia 2: Fallback para ILIKE se RPC falhar ou não existir
  if (records.length === 0) {
    urlStr = `${postgrestUrl}/mv_votos_candidato?sg_uf=eq.${uf}&nm_candidato=ilike.*${encodeURIComponent(nomeCompleto)}*&order=ano_eleicao.desc`
    response = await fetch(urlStr)
    if (response.ok) {
      records = (await response.json() as VotosCandidatoRecord[]).filter(confere)
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
        records = (await response.json() as VotosCandidatoRecord[]).filter(confere)
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
        records = (await response.json() as VotosCandidatoRecord[]).filter(confere)
      }
    }
  }

  if (records.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Candidato não encontrado',
    })
  }

  return { uf, records }
}
