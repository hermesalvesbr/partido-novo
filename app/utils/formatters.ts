/**
 * Utilitários de formatação para exibição de dados eleitorais
 */

/**
 * Formata números grandes para exibição compacta
 * @example formatNumber(1500000) => "1.5M"
 * @example formatNumber(1500) => "1.5K"
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(1)}K`
  return num.toLocaleString('pt-BR')
}

/**
 * Retorna a cor do chip baseado na situação do candidato
 */
export function getSituacaoColor(situacao: string): string {
  if (!situacao)
    return 'grey'

  const s = situacao.toUpperCase()

  // Verificar NÃO ELEITO primeiro (contém "ELEITO" também)
  if (s.includes('NÃO ELEITO'))
    return 'error'
  if (s.includes('SUPLENTE'))
    return 'grey'
  if (s.includes('2º TURNO'))
    return 'warning'
  if (s.includes('ELEITO'))
    return 'success'

  return 'grey'
}

/**
 * Formata a situação do candidato para exibição
 * Retorna string vazia para "não eleito" (não mostrar)
 */
export function formatSituacao(situacao: string): string {
  if (!situacao)
    return '—'

  const s = situacao.toUpperCase()

  if (s.includes('NÃO ELEITO'))
    return '' // Não mostra nada
  if (s.includes('SUPLENTE'))
    return 'SUPLENTE'
  if (s.includes('2º TURNO'))
    return '2º TURNO'
  if (s.includes('ELEITO'))
    return 'ELEITO'

  return ''
}
