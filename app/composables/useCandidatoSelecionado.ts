/**
 * Composable para compartilhar dados do candidato selecionado entre páginas
 * Usa useState para persistência SSR-friendly durante a navegação
 */

import { slugify } from '~/utils/slug'

export interface CandidatoSelecionado {
  nm_candidato: string
  nm_urna_candidato: string
  sg_uf: string
  sg_partido?: string
  ds_cargo?: string
  ano_eleicao?: number
}

export function useCandidatoSelecionado() {
  // Estado compartilhado entre páginas (SSR-friendly)
  const candidatoSelecionado = useState<CandidatoSelecionado | null>(
    'candidato-selecionado',
    () => null,
  )

  /**
   * Define o candidato selecionado antes de navegar
   */
  function setCandidato(candidato: CandidatoSelecionado): void {
    candidatoSelecionado.value = candidato
  }

  /**
   * Obtém o candidato selecionado se o slug corresponder
   * Compara usando slugify para garantir match mesmo com acentos
   */
  function getCandidatoBySlug(nomeSlug: string): CandidatoSelecionado | null {
    const candidato = candidatoSelecionado.value

    // Verifica se o candidato corresponde ao slug esperado
    if (candidato && slugify(candidato.nm_candidato) === nomeSlug) {
      return candidato
    }

    return null
  }

  /**
   * Limpa o candidato selecionado
   */
  function clearCandidato(): void {
    candidatoSelecionado.value = null
  }

  return {
    candidatoSelecionado: readonly(candidatoSelecionado),
    setCandidato,
    getCandidatoBySlug,
    clearCandidato,
  }
}
