/**
 * Utilitários para partidos políticos
 */

// Mapeamento de siglas de partido para arquivos de logo (chaves normalizadas: UPPERCASE sem acentos)
const PARTIDO_LOGOS: Record<string, string> = {
  'AGIR': 'AGIR.png',
  'AVANTE': 'AVANTE.png',
  'CIDADANIA': 'CIDADANIA.png',
  'DC': 'DC.png',
  'DEM': 'DEM.png',
  'MDB': 'MDB.png',
  'MOBILIZA': 'MOBILIZA.png',
  'NOVO': 'NOVO.png',
  'PATRIOTA': 'PATRIOTA.png',
  'PCB': 'PCB.png',
  'PC DO B': 'PCdoB.png',
  'PCDOB': 'PCdoB.png',
  'PCO': 'PCO.png',
  'PDT': 'PDT.png',
  'PL': 'PL.png',
  'PMB': 'PMB.png',
  'PMN': 'PMN.png',
  'PODE': 'PODE.png',
  'PODEMOS': 'PODE.png',
  'PP': 'PP.png',
  'PRD': 'PRD.png',
  'PROS': 'PROS.png',
  'PRTB': 'PRTB.png',
  'PSB': 'PSB.png',
  'PSC': 'PSC.png',
  'PSD': 'PSD.png',
  'PSDB': 'PSDB.png',
  'PSL': 'PSL.png',
  'PSOL': 'PSOL.png',
  'PSTU': 'PSTU.png',
  'PT': 'PT.png',
  'PTB': 'PTB.png',
  'PTC': 'PTC.png',
  'PV': 'PV.jpg',
  'REDE': 'REDE.png',
  'REPUBLICANOS': 'REPUBLICANOS.png',
  'RFB': 'RFB.png',
  'SOLIDARIEDADE': 'SOLIDARIEDADE.png',
  'UNIAO': 'UNIAO.png',
  'UNIAO BRASIL': 'UNIAO.png',
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

  // Normaliza: trim, uppercase e remove acentos
  const siglaNormalizada = sigla
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')

  const logoFile = PARTIDO_LOGOS[siglaNormalizada]

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
