/**
 * Utilitários para partidos políticos
 */

// Mapeamento de siglas de partido para arquivos de logo
const PARTIDO_LOGOS: Record<string, string> = {
  'AGIR': 'AGIR.png',
  'AVANTE': 'AVANTE.png',
  'CIDADANIA': 'CIDADANIA.png',
  'DC': 'DC.png',
  'MDB': 'MDB.png',
  'MOBILIZA': 'MOBILIZA.png',
  'NOVO': 'NOVO.png',
  'PCB': 'PCB.png',
  'PC do B': 'PCdoB.png',
  'PCdoB': 'PCdoB.png',
  'PCO': 'PCO.png',
  'PDT': 'PDT.png',
  'PL': 'PL.png',
  'PMB': 'PMB.png',
  'PODE': 'PODE.png',
  'PODEMOS': 'PODE.png',
  'PP': 'PP.png',
  'PRD': 'PRD.png',
  'PRTB': 'PRTB.png',
  'PSB': 'PSB.png',
  'PSD': 'PSD.png',
  'PSDB': 'PSDB.png',
  'PSOL': 'PSOL.png',
  'PSTU': 'PSTU.png',
  'PT': 'PT.png',
  'PV': 'PV.jpg',
  'REDE': 'REDE.png',
  'REPUBLICANOS': 'REPUBLICANOS.png',
  'RFB': 'RFB.png',
  'SOLIDARIEDADE': 'SOLIDARIEDADE.png',
  'SOLIDARIEDADE ': 'SOLIDARIEDADE.png',
  'UNIÃO': 'UNIAO.png',
  'UNIAO': 'UNIAO.png',
  'UNIÃO BRASIL': 'UNIAO.png',
  'UP': 'UP.png',
}

/**
 * Retorna a URL do logo do partido
 * @param sigla Sigla do partido (ex: PT, PSDB, NOVO)
 * @returns URL do logo ou null se não existir
 */
export function getPartidoLogoUrl(sigla: string | undefined | null): string | null {
  if (!sigla)
    return null

  const siglaUpper = sigla.trim().toUpperCase()
  const logoFile = PARTIDO_LOGOS[siglaUpper]

  if (!logoFile)
    return null

  return `/partido/${logoFile}`
}

/**
 * Verifica se existe logo para o partido
 */
export function hasPartidoLogo(sigla: string | undefined | null): boolean {
  return getPartidoLogoUrl(sigla) !== null
}
