/**
 * Composable para gerenciar candidatos favoritos
 * Usa useCookie para persistência SSR-friendly por 365 dias
 */

export interface CandidatoFavorito {
  slug: string
  nome: string // nm_urna_candidato (nome na urna)
  nomeCompleto?: string // nm_candidato (nome civil completo) - para busca eficiente
  uf: string
  partido?: string
  cargo?: string
  addedAt: number // timestamp
}

export function useFavoritos() {
  // Cookie com validade de 365 dias (em segundos)
  const favoritos = useCookie<CandidatoFavorito[]>('candidatos-favoritos', {
    default: () => [],
    maxAge: 60 * 60 * 24 * 365, // 365 dias
    watch: 'shallow',
  })

  /**
   * Verifica se um candidato está nos favoritos
   */
  function isFavorito(slug: string): boolean {
    return favoritos.value?.some(f => f.slug === slug) ?? false
  }

  /**
   * Adiciona um candidato aos favoritos
   */
  function addFavorito(candidato: Omit<CandidatoFavorito, 'addedAt'>) {
    if (!favoritos.value) {
      favoritos.value = []
    }

    // Evita duplicatas
    if (isFavorito(candidato.slug)) {
      return
    }

    const novoFavorito: CandidatoFavorito = {
      ...candidato,
      addedAt: Date.now(),
    }

    // Cria novo array para trigger watch shallow
    favoritos.value = [...favoritos.value, novoFavorito]
  }

  /**
   * Remove um candidato dos favoritos
   */
  function removeFavorito(slug: string) {
    if (!favoritos.value)
      return

    favoritos.value = favoritos.value.filter(f => f.slug !== slug)
  }

  /**
   * Toggle favorito - adiciona ou remove
   */
  function toggleFavorito(candidato: Omit<CandidatoFavorito, 'addedAt'>) {
    if (isFavorito(candidato.slug)) {
      removeFavorito(candidato.slug)
    }
    else {
      addFavorito(candidato)
    }
  }

  /**
   * Limpa todos os favoritos
   */
  function clearFavoritos() {
    favoritos.value = []
  }

  /**
   * Retorna favoritos ordenados por data de adição (mais recentes primeiro)
   */
  const favoritosOrdenados = computed(() => {
    if (!favoritos.value)
      return []
    return [...favoritos.value].sort((a, b) => b.addedAt - a.addedAt)
  })

  /**
   * Quantidade de favoritos
   */
  const totalFavoritos = computed(() => favoritos.value?.length ?? 0)

  return {
    favoritos,
    favoritosOrdenados,
    totalFavoritos,
    isFavorito,
    addFavorito,
    removeFavorito,
    toggleFavorito,
    clearFavoritos,
  }
}
