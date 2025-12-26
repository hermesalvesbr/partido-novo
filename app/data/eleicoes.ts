// Dados estáticos para filtros de eleições
// Estes dados são extraídos das views materializadas do banco de dados

// Estados brasileiros (UFs)
export const ESTADOS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

// Partidos políticos com sigla e nome completo
export const PARTIDOS = [
  { sigla: 'AGIR', nome: 'Agir' },
  { sigla: 'AVANTE', nome: 'Avante' },
  { sigla: 'CIDADANIA', nome: 'Cidadania' },
  { sigla: 'DC', nome: 'Democracia Cristã' },
  { sigla: 'DEM', nome: 'Democratas' },
  { sigla: 'MDB', nome: 'Movimento Democrático Brasileiro' },
  { sigla: 'MOBILIZA', nome: 'Mobilização Nacional' },
  { sigla: 'NOVO', nome: 'Partido Novo' },
  { sigla: 'PATRIOTA', nome: 'Patriota' },
  { sigla: 'PCB', nome: 'Partido Comunista Brasileiro' },
  { sigla: 'PC do B', nome: 'Partido Comunista do Brasil' },
  { sigla: 'PCO', nome: 'Partido da Causa Operária' },
  { sigla: 'PDT', nome: 'Partido Democrático Trabalhista' },
  { sigla: 'PL', nome: 'Partido Liberal' },
  { sigla: 'PMB', nome: 'Partido da Mulher Brasileira' },
  { sigla: 'PMN', nome: 'Partido da Mobilização Nacional' },
  { sigla: 'PODE', nome: 'Podemos' },
  { sigla: 'PP', nome: 'Progressistas' },
  { sigla: 'PRD', nome: 'Partido Renovação Democrática' },
  { sigla: 'PROS', nome: 'Partido Republicano da Ordem Social' },
  { sigla: 'PRTB', nome: 'Partido Renovador Trabalhista Brasileiro' },
  { sigla: 'PSB', nome: 'Partido Socialista Brasileiro' },
  { sigla: 'PSC', nome: 'Partido Social Cristão' },
  { sigla: 'PSD', nome: 'Partido Social Democrático' },
  { sigla: 'PSDB', nome: 'Partido da Social Democracia Brasileira' },
  { sigla: 'PSL', nome: 'Partido Social Liberal' },
  { sigla: 'PSOL', nome: 'Partido Socialismo e Liberdade' },
  { sigla: 'PSTU', nome: 'Partido Socialista dos Trabalhadores Unificado' },
  { sigla: 'PT', nome: 'Partido dos Trabalhadores' },
  { sigla: 'PTB', nome: 'Partido Trabalhista Brasileiro' },
  { sigla: 'PTC', nome: 'Partido Trabalhista Cristão' },
  { sigla: 'PV', nome: 'Partido Verde' },
  { sigla: 'REDE', nome: 'Rede Sustentabilidade' },
  { sigla: 'REPUBLICANOS', nome: 'Republicanos' },
  { sigla: 'SOLIDARIEDADE', nome: 'Solidariedade' },
  { sigla: 'UNIÃO', nome: 'União Brasil' },
  { sigla: 'UP', nome: 'Unidade Popular' },
] as const

// Lista simplificada de siglas de partidos para o select
export const PARTIDOS_SIGLAS = PARTIDOS.map(p => p.sigla)

// Cargos disponíveis nas eleições
export const CARGOS = [
  'Presidente',
  'Governador',
  'Senador',
  'Deputado Federal',
  'Deputado Estadual',
  'Deputado Distrital',
  'Prefeito',
  'Vereador',
] as const

// Anos de eleições disponíveis
export const ANOS_ELEICAO = [2024, 2022, 2020, 2018] as const

// Tipos de eleição por ano
export const TIPOS_ELEICAO = {
  2018: { tipo: 'Gerais', cargos: ['Presidente', 'Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual', 'Deputado Distrital'] },
  2020: { tipo: 'Municipais', cargos: ['Prefeito', 'Vereador'] },
  2022: { tipo: 'Gerais', cargos: ['Presidente', 'Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual', 'Deputado Distrital'] },
  2024: { tipo: 'Municipais', cargos: ['Prefeito', 'Vereador'] },
} as const

// Turnos
export const TURNOS = [
  { title: '1º Turno', value: 1 },
  { title: '2º Turno', value: 2 },
] as const

// Situações possíveis do candidato
export const SITUACOES = [
  'ELEITO',
  'ELEITO POR QP',
  'ELEITO POR MÉDIA',
  'NÃO ELEITO',
  '2º TURNO',
  'SUPLENTE',
  'MÉDIA',
  '#NULO#',
  '#NE#',
] as const

// Cores dos partidos para visualização
export const CORES_PARTIDOS: Record<string, string> = {
  'PT': '#CC0000',
  'PL': '#003399',
  'PSDB': '#0066CC',
  'MDB': '#00CC00',
  'PP': '#003366',
  'PDT': '#FF6600',
  'PSB': '#FFCC00',
  'UNIÃO': '#336699',
  'PSOL': '#990066',
  'NOVO': '#FF6600',
  'PSD': '#006633',
  'REPUBLICANOS': '#004080',
  'CIDADANIA': '#FF69B4',
  'PODE': '#8B4513',
  'AVANTE': '#FF8C00',
  'SOLIDARIEDADE': '#FFA500',
  'PC do B': '#DC143C',
  'PV': '#228B22',
  'REDE': '#00CED1',
}

// Types
export type Estado = (typeof ESTADOS)[number]
export type PartidoSigla = (typeof PARTIDOS)[number]['sigla']
export type Cargo = (typeof CARGOS)[number]
export type AnoEleicao = (typeof ANOS_ELEICAO)[number]
export type Turno = (typeof TURNOS)[number]
export type Situacao = (typeof SITUACOES)[number]

// Interface para candidato retornado pela API
export interface CandidatoVotos {
  sq_candidato: number
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  nm_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  nr_turno: number
  ds_sit_tot_turno: string
  total_votos: number
  municipios_votados: number
  zonas_contadas: number
}

// Interface para estatísticas por ano
export interface StatsAno {
  ano_eleicao: number
  total_candidatos: number
  total_municipios: number
  total_partidos: number
  total_ufs: number
  total_votos: number
}

// Interface para top candidatos
export interface TopCandidato {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  total_votos: number
  ds_sit_tot_turno: string
}

// Interface para estatísticas de partido
export interface StatsPartido {
  sg_partido: string
  nm_partido: string
  ano_eleicao: number
  ds_cargo: string
  total_candidatos: number
  total_votos: number
  media_votos: number
  eleitos: number
}
