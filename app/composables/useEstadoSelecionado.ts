import type { Estado } from '~/data/eleicoes'
import { ESTADOS } from '~/data/eleicoes'

// Estado global compartilhado entre composables
const estadoSelecionado = ref<Estado | null>(null)

/**
 * Composable para compartilhar o estado (UF) selecionado globalmente
 * Usado entre a busca de candidatos e a página de regiões
 */
export function useEstadoSelecionado() {
  // Definir estado
  function setEstado(uf: Estado | null) {
    estadoSelecionado.value = uf
  }

  // Limpar estado
  function clearEstado() {
    estadoSelecionado.value = null
  }

  // Verificar se é um estado válido
  function isValidEstado(code: string | null | undefined): code is Estado {
    if (!code) return false
    return (ESTADOS as readonly string[]).includes(code)
  }

  return {
    estadoSelecionado: readonly(estadoSelecionado),
    setEstado,
    clearEstado,
    isValidEstado,
  }
}
