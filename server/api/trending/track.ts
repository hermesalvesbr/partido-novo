/**
 * API para rastrear acessos a candidatos (armazena timestamps no KV)
 *
 * POST /api/trending/track
 * Body: { slug: string, uf: string, nome: string, partido: string, ... }
 *
 * Armazena no Cloudflare KV:
 * - trending:hits:{uf}:{slug} = array de timestamps (últimos 12 meses)
 * - trending:meta:{uf}:{slug} = { nome, partido, cargo, ... }
 * - trending:index:{uf} = Set de slugs para iteração
 */

// Constantes de tempo
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_TO_KEEP = 365 // Mantém 12 meses de histórico

interface TrackBody {
  slug: string
  uf: string
  nome: string
  nomeCompleto: string
  partido: string
  cargo: string
  anoEleicao: number
  situacao: string
  totalVotos: number
}

interface CandidatoMeta {
  nome: string
  nomeCompleto: string
  partido: string
  cargo: string
  anoEleicao: number
  situacao: string
  totalVotos: number
  lastAccess: number
}

export default defineEventHandler(async (event) => {
  // Apenas POST
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: 'Método não permitido',
    })
  }

  const body = await readBody<TrackBody>(event)

  if (!body?.slug || !body?.uf || !body?.nome) {
    throw createError({
      statusCode: 400,
      message: 'Campos obrigatórios: slug, uf, nome',
    })
  }

  const { slug, uf, nome, nomeCompleto, partido, cargo, anoEleicao, situacao, totalVotos } = body
  const ufUpper = uf.toUpperCase()

  try {
    const storage = useStorage('cache')
    const now = Date.now()
    const cutoff = now - (DAYS_TO_KEEP * MS_PER_DAY)

    // Chaves no KV
    const hitsKey = `trending:hits:${ufUpper}:${slug}`
    const metaKey = `trending:meta:${ufUpper}:${slug}`
    const indexKey = `trending:index:${ufUpper}`

    // 1. Adicionar timestamp ao array de hits (e limpar antigos)
    const hits = await storage.getItem<number[]>(hitsKey) || []
    // Filtra timestamps mais antigos que 12 meses e adiciona o novo
    const updatedHits = [...hits.filter(t => t > cutoff), now]
    await storage.setItem(hitsKey, updatedHits)

    // 2. Atualizar metadados do candidato
    const meta: CandidatoMeta = {
      nome,
      nomeCompleto: nomeCompleto || nome,
      partido: partido || '',
      cargo: cargo || '',
      anoEleicao: anoEleicao || 0,
      situacao: situacao || '',
      totalVotos: totalVotos || 0,
      lastAccess: now,
    }
    await storage.setItem(metaKey, meta)

    // 3. Adicionar slug ao índice da UF
    const index = await storage.getItem<string[]>(indexKey) || []
    if (!index.includes(slug)) {
      index.push(slug)
      await storage.setItem(indexKey, index)
    }

    return { success: true, count: updatedHits.length }
  }
  catch (error) {
    console.error('Erro ao rastrear acesso:', error)
    return { success: false, error: 'Erro ao registrar acesso' }
  }
})
