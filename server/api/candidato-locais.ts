/**
 * Votos do candidato por local de votação (escola) numa eleição.
 *
 * GET /api/candidato-locais?slug=pe-fulano&ano=2026
 *
 * Os dados vêm da RPC votos_locais_candidato (scripts/create_votos_locais.sql),
 * alimentada por scripts/import_locais.ts. Anos/UFs sem esse import respondem
 * { disponivel: false }. Os agregados (bairro, área, zona, região) são feitos no
 * cliente, porque mudam com o filtro de município.
 */
import type { CandidatoLocaisResponse, LocalVotacaoVotos, MunicipioLocais, TipoArea } from '~/data/eleicoes'
import { ANOS_COM_LOCAIS, UFS_COM_LOCAIS } from '~/data/eleicoes'

interface LinhaRpc {
  cd_municipio: number
  nm_municipio: string | null
  cd_ibge: number | null
  nm_microrregiao: string | null
  nm_mesorregiao: string | null
  nr_zona: number
  nr_local_votacao: number
  nm_local: string
  nm_bairro: string | null
  tipo_area: TipoArea
  nr_latitude: number | null
  nr_longitude: number | null
  qt_eleitores: number
  qt_votos: number
  qt_validos: number
}

const TURNO = 1

function arredondar(valor: number, casas: number) {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

export default defineCachedEventHandler(async (event): Promise<CandidatoLocaisResponse> => {
  const query = getQuery(event)
  const config = useRuntimeConfig()
  const postgrestUrl = config.public.postgrestUrl as string
  const { uf, records } = await buscarCandidatoPorSlug(query.slug as string | undefined, postgrestUrl)

  const ano = Number(query.ano) || Math.max(...records.map(r => r.ano_eleicao))
  // 1º turno: no 2º o mesmo eleitor votaria de novo
  const registro = records.find(r => r.ano_eleicao === ano && r.nr_turno === TURNO)

  const vazio: CandidatoLocaisResponse = {
    disponivel: false,
    ano,
    turno: TURNO,
    nm_urna_candidato: records[0]!.nm_urna_candidato,
    nm_candidato: records[0]!.nm_candidato,
    ds_cargo: registro?.ds_cargo ?? '',
    sg_partido: registro?.sg_partido ?? '',
    totalVotos: 0,
    locais: [],
    municipios: [],
  }
  if (!registro || !ANOS_COM_LOCAIS.includes(ano) || !UFS_COM_LOCAIS.includes(uf))
    return vazio

  const resp = await fetch(`${postgrestUrl}/rpc/votos_locais_candidato?p_sq=${registro.sq_candidato}&p_ano=${ano}&p_turno=${TURNO}`)
  if (!resp.ok) {
    console.error('PostgREST votos_locais_candidato:', resp.status, await resp.text())
    throw createError({ statusCode: 502, message: 'Falha ao consultar votos por local' })
  }
  const linhas = await resp.json() as LinhaRpc[]
  if (linhas.length === 0)
    return vazio

  const totalVotos = linhas.reduce((a, l) => a + l.qt_votos, 0)
  const municipios = new Map<string, MunicipioLocais>()
  const locais: LocalVotacaoVotos[] = linhas.map((l) => {
    const municipio = l.nm_municipio ?? String(l.cd_municipio)
    const m = municipios.get(municipio) ?? {
      nome: municipio,
      cdIbge: l.cd_ibge,
      votos: 0,
      locais: 0,
      microrregiao: l.nm_microrregiao ?? '',
      mesorregiao: l.nm_mesorregiao ?? '',
    }
    m.votos += l.qt_votos
    m.locais++
    municipios.set(municipio, m)
    return {
      id: `${l.cd_municipio}-${l.nr_zona}-${l.nr_local_votacao}`,
      municipio,
      zona: l.nr_zona,
      local: l.nm_local,
      bairro: l.nm_bairro || 'Não informado',
      area: l.tipo_area,
      // ~1 m de precisão basta para o mapa e corta o tamanho da resposta
      lat: l.nr_latitude == null ? null : arredondar(l.nr_latitude, 5),
      lon: l.nr_longitude == null ? null : arredondar(l.nr_longitude, 5),
      eleitores: l.qt_eleitores,
      votos: l.qt_votos,
      pctLocal: l.qt_validos > 0 ? arredondar((l.qt_votos / l.qt_validos) * 100, 2) : 0,
    }
  })

  return {
    ...vazio,
    disponivel: true,
    totalVotos,
    locais,
    municipios: [...municipios.values()].sort((a, b) => b.votos - a.votos),
  }
}, {
  // Dados eleitorais não mudam depois do import; invalidação via /api/cache/invalidate
  maxAge: 60 * 60 * 24 * 365,
  staleMaxAge: -1,
  base: 'cache',
  group: 'candidato-locais',
  getKey: (event) => {
    const query = getQuery(event)
    return `v2:${query.slug || 'unknown'}:${query.ano || 'ultimo'}`
  },
  swr: true,
})
