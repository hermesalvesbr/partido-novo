import type { AgregadoVotos, LocalVotacaoVotos, MunicipioLocais, TipoArea } from '~/data/eleicoes'
import { TIPOS_AREA } from '~/data/eleicoes'

/**
 * Soma os votos dos locais por uma chave (bairro, zona, região...).
 * pctTotal é sobre o total dos locais recebidos, ou seja, já respeita o filtro.
 */
export function agruparLocais(
  locais: LocalVotacaoVotos[],
  chave: (l: LocalVotacaoVotos) => { nome: string, municipio?: string },
): AgregadoVotos[] {
  const total = locais.reduce((a, l) => a + l.votos, 0)
  const mapa = new Map<string, AgregadoVotos>()
  for (const l of locais) {
    const { nome, municipio } = chave(l)
    const id = `${municipio ?? ''}|${nome}`
    const item = mapa.get(id) ?? { nome, municipio, votos: 0, locais: 0, pctTotal: 0 }
    item.votos += l.votos
    item.locais++
    mapa.set(id, item)
  }
  return [...mapa.values()]
    .map(a => ({ ...a, pctTotal: total > 0 ? (a.votos / total) * 100 : 0 }))
    .sort((a, b) => b.votos - a.votos)
}

/** Bairro só faz sentido junto do município ("CENTRO" existe em todos) */
export function porBairro(locais: LocalVotacaoVotos[]): AgregadoVotos[] {
  return agruparLocais(locais, l => ({ nome: l.bairro, municipio: l.municipio }))
}

/** Sede, distritos, povoados e zona rural, sempre nessa ordem e com as 4 linhas */
export function porArea(locais: LocalVotacaoVotos[]): AgregadoVotos[] {
  const agregados = agruparLocais(locais, l => ({ nome: l.area }))
  return (Object.keys(TIPOS_AREA) as TipoArea[]).map(area => ({
    ...(agregados.find(a => a.nome === area) ?? { votos: 0, locais: 0, pctTotal: 0 }),
    nome: TIPOS_AREA[area],
  }))
}

export function porZona(locais: LocalVotacaoVotos[]): AgregadoVotos[] {
  return agruparLocais(locais, l => ({ nome: `Zona ${l.zona}`, municipio: l.municipio }))
}

export function porRegiao(
  locais: LocalVotacaoVotos[],
  municipios: MunicipioLocais[],
  nivel: 'microrregiao' | 'mesorregiao',
): AgregadoVotos[] {
  const regiao = new Map(municipios.map(m => [m.nome, m[nivel] || 'Não informada']))
  return agruparLocais(locais, l => ({ nome: regiao.get(l.municipio) ?? 'Não informada' }))
}

// Siglas comuns em nomes de escola do TSE; ficam em maiúsculas
const SIGLAS = new Set(['erem', 'ete', 'etec', 'ifpe', 'ifsertao', 'upe', 'ufpe', 'ufrpe', 'univasf', 'sesi', 'senai', 'sesc', 'senac', 'caic', 'ciep', 'emef', 'emei', 'eref', 'cmei', 'cemei', 'fafopa', 'ee', 'em', 'eem', 'eef', 'emeif', 'apae', 'cras', 'psf', 'ubs', 'br'])
// Abreviações sem vogal que não são sigla ("DR.", "STA.")
const ABREVIACOES = new Set(['dr', 'dra', 'sr', 'sra', 'sto', 'sta', 'pr', 'pe'])
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** "EREM PADRE LUIZ GONZAGA" -> "EREM Padre Luiz Gonzaga" */
export function tituloLocal(texto: string): string {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => {
      const limpa = p.replace(/[^a-z0-9]/g, '')
      if (SIGLAS.has(limpa) || /^[ivx]+$/.test(limpa) || (limpa.length > 1 && !ABREVIACOES.has(limpa) && !/[aeiouyáéíóúâêôãõà]/.test(p)))
        return p.toUpperCase()
      if (i > 0 && MINUSCULAS.has(p))
        return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
}

/** Para texto que entra no HTML de tooltips do ECharts */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
}
