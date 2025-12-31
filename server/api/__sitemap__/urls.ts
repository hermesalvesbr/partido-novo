/**
 * Endpoint para gerar URLs dinâmicas para o sitemap
 *
 * Usa os candidatos já trackados no cache (trending) para gerar o sitemap.
 * Isso garante que apenas candidatos realmente acessados apareçam no sitemap.
 *
 * @see https://nuxtseo.com/docs/sitemap/guides/dynamic-urls
 */

import type { SitemapUrlInput } from '#sitemap/types'
import { defineSitemapEventHandler } from '#imports'
import { ESTADOS } from '~/data/eleicoes'

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

export default defineSitemapEventHandler(async () => {
  try {
    const storage = useStorage('cache')
    const urls: SitemapUrlInput[] = []

    // Iterar por todos os estados para buscar candidatos trackados
    for (const uf of ESTADOS) {
      const indexKey = `trending:index:${uf}`
      const slugs = await storage.getItem<string[]>(indexKey) || []

      // Para cada slug, buscar metadados e adicionar ao sitemap
      for (const slug of slugs) {
        const metaKey = `trending:meta:${uf}:${slug}`
        const meta = await storage.getItem<CandidatoMeta>(metaKey)

        if (meta) {
          const isRecent = meta.anoEleicao >= 2022
          const hasGoodData = meta.cargo && meta.totalVotos > 0

          // Só inclui candidatos com dados completos
          if (hasGoodData) {
            urls.push({
              loc: `/candidato/${slug}`,
              priority: isRecent ? 0.8 : 0.5,
              changefreq: isRecent ? 'monthly' : 'yearly',
              lastmod: meta.lastAccess
                ? new Date(meta.lastAccess).toISOString()
                : new Date(`${meta.anoEleicao}-12-31`).toISOString(),
            })
          }
        }
      }
    }

    return urls
  }
  catch (error) {
    console.error('[Sitemap] Erro ao buscar candidatos do cache:', error)
    return []
  }
})
