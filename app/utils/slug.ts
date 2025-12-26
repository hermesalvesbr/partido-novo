/**
 * Utilitários para geração de slugs
 */

/**
 * Converte texto para slug URL-friendly
 * Remove acentos, caracteres especiais e substitui espaços por hífens
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Normaliza para separar acentos
    .replace(/[\u0300-\u036F]/g, '') // Remove acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Espaços para hífens
    .replace(/[^\w-]+/g, '') // Remove caracteres especiais
    .replace(/-{2,}/g, '-') // Remove hífens duplicados
    .replace(/^-+/, '') // Remove hífen do início
    .replace(/-+$/, '') // Remove hífen do final
}

/**
 * Gera slug único para candidato: UF-nome-completo
 * @example generateCandidatoSlug('PE', 'NUNES RAFAEL MENDES COELHO') => 'pe-nunes-rafael-mendes-coelho'
 */
export function generateCandidatoSlug(uf: string, nmCandidato: string): string {
  return `${slugify(uf)}-${slugify(nmCandidato)}`
}

/**
 * Gera slug para candidato baseado no nome de urna (mais consistente entre eleições)
 * @example generateCandidatoSlugFromUrna('PE', 'GEORGE BASTOS') => 'pe-george-bastos'
 */
export function generateCandidatoSlugFromUrna(uf: string, nmUrna: string): string {
  return `${slugify(uf)}-${slugify(nmUrna)}`
}

/**
 * Extrai UF e nome do slug do candidato
 * @example parseCandidatoSlug('pe-nunes-rafael-mendes-coelho') => { uf: 'PE', nomeSlug: 'nunes-rafael-mendes-coelho' }
 */
export function parseCandidatoSlug(slug: string): { uf: string, nomeSlug: string } | null {
  const parts = slug.split('-')
  if (parts.length < 2)
    return null

  const firstPart = parts[0]
  if (!firstPart)
    return null

  const uf = firstPart.toUpperCase()
  const nomeSlug = parts.slice(1).join('-')

  return { uf, nomeSlug }
}
