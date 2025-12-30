/**
 * API endpoint para invalidar cache de candidatos no Cloudflare KV
 *
 * Uso:
 * - POST /api/cache/invalidate?slug=pe-joao-silva  (invalida um candidato específico)
 * - POST /api/cache/invalidate?all=true            (invalida todo o cache de candidatos)
 *
 * Requer header Authorization com token configurado em NUXT_CACHE_INVALIDATE_TOKEN
 */

export default defineEventHandler(async (event) => {
  // Verificar método
  if (event.method !== 'POST') {
    throw createError({
      statusCode: 405,
      message: 'Método não permitido. Use POST.',
    })
  }

  // Verificar autorização (proteção básica)
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'authorization')
  const expectedToken = config.cacheInvalidateToken

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    throw createError({
      statusCode: 401,
      message: 'Token de autorização inválido',
    })
  }

  const query = getQuery(event)
  const slug = query.slug as string | undefined
  const all = query.all === 'true'

  const storage = useStorage('cache')
  const deletedKeys: string[] = []

  try {
    if (all) {
      // Buscar todas as chaves do grupo candidato
      const keys = await storage.getKeys('candidato')
      for (const key of keys) {
        await storage.removeItem(key)
        deletedKeys.push(key)
      }
    }
    else if (slug) {
      // Invalidar apenas o slug específico
      const key = `candidato:v12:${slug}`
      const exists = await storage.hasItem(key)
      if (exists) {
        await storage.removeItem(key)
        deletedKeys.push(key)
      }
    }
    else {
      throw createError({
        statusCode: 400,
        message: 'Forneça ?slug=... ou ?all=true',
      })
    }

    return {
      success: true,
      message: `Cache invalidado: ${deletedKeys.length} item(s)`,
      keys: deletedKeys,
    }
  }
  catch (error: any) {
    if (error.statusCode)
      throw error
    throw createError({
      statusCode: 500,
      message: `Erro ao invalidar cache: ${error.message}`,
    })
  }
})
