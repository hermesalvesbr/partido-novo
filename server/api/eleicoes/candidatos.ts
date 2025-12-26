import postgres from 'postgres'

// Database connection using Cloudflare Hyperdrive or direct connection
// Uses import.meta.env for Cloudflare Pages compatibility
function getDB() {
  const config = useRuntimeConfig()
  
  // Cloudflare Hyperdrive connection string (preferred) or fallback to individual vars
  const connectionString = config.databaseUrl || import.meta.env.DATABASE_URL
  
  if (connectionString) {
    return postgres(connectionString, { max: 10 })
  }
  
  // Fallback to individual environment variables
  return postgres({
    host: config.pgHost,
    port: Number.parseInt(config.pgPort || '5423'),
    username: config.pgUser,
    password: config.pgPassword,
    database: config.pgDatabase,
    max: 10,
  })
}

// Election types mapping
const ELECTION_TYPES = {
  2018: { type: 'Gerais', cargos: ['PRESIDENTE', 'GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL'] },
  2020: { type: 'Municipais', cargos: ['PREFEITO', 'VEREADOR'] },
  2022: { type: 'Gerais', cargos: ['PRESIDENTE', 'GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 'DEPUTADO ESTADUAL'] },
  2024: { type: 'Municipais', cargos: ['PREFEITO', 'VEREADOR'] },
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const sql = getDB()
  
  try {
    const {
      candidato,
      partido,
      uf,
      municipio,
      ano,
      cargo,
      turno,
      page = 1,
      limit = 50,
    } = query
    
    // Build dynamic WHERE clauses
    const conditions: string[] = []
    const params: unknown[] = []
    
    if (candidato) {
      conditions.push(`UPPER(nm_candidato) LIKE UPPER($${params.length + 1})`)
      params.push(`%${candidato}%`)
    }
    
    if (partido) {
      conditions.push(`sg_partido = $${params.length + 1}`)
      params.push(partido.toString().toUpperCase())
    }
    
    if (uf) {
      conditions.push(`sg_uf = $${params.length + 1}`)
      params.push(uf.toString().toUpperCase())
    }
    
    if (municipio) {
      conditions.push(`UPPER(nm_municipio) LIKE UPPER($${params.length + 1})`)
      params.push(`%${municipio}%`)
    }
    
    if (ano) {
      conditions.push(`ano_eleicao = $${params.length + 1}`)
      params.push(Number.parseInt(ano.toString()))
    }
    
    if (cargo) {
      conditions.push(`UPPER(ds_cargo) LIKE UPPER($${params.length + 1})`)
      params.push(`%${cargo}%`)
    }
    
    if (turno) {
      conditions.push(`nr_turno = $${params.length + 1}`)
      params.push(Number.parseInt(turno.toString()))
    }
    
    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : ''
    
    const offset = (Number.parseInt(page.toString()) - 1) * Number.parseInt(limit.toString())
    
    const results = await sql.unsafe(`
      SELECT 
        nm_candidato,
        nm_urna_candidato,
        sq_candidato,
        sg_partido,
        nm_partido,
        ds_cargo,
        ano_eleicao,
        sg_uf,
        nm_municipio,
        nr_turno,
        ds_sit_tot_turno,
        SUM(qt_votos_nominais) as total_votos,
        COUNT(DISTINCT nr_zona) as zonas_contadas
      FROM votacao_candidato_munzona
      ${whereClause}
      GROUP BY 
        nm_candidato, nm_urna_candidato, sq_candidato, 
        sg_partido, nm_partido, ds_cargo, ano_eleicao, 
        sg_uf, nm_municipio, nr_turno, ds_sit_tot_turno
      ORDER BY total_votos DESC
      LIMIT ${Number.parseInt(limit.toString())} OFFSET ${offset}
    `, params)
    
    const countResult = await sql.unsafe(`
      SELECT COUNT(DISTINCT (sq_candidato, ano_eleicao, nr_turno, sg_uf, nm_municipio)) as total
      FROM votacao_candidato_munzona
      ${whereClause}
    `, params)
    
    const total = Number.parseInt(countResult[0]?.total || '0')
    
    await sql.end()
    
    return {
      success: true,
      data: results,
      pagination: {
        page: Number.parseInt(page.toString()),
        limit: Number.parseInt(limit.toString()),
        total,
        pages: Math.ceil(total / Number.parseInt(limit.toString()))
      },
      filters: { candidato, partido, uf, municipio, ano, cargo, turno },
      electionTypes: ELECTION_TYPES
    }
    
  } catch (error: unknown) {
    await sql.end()
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw createError({
      statusCode: 500,
      statusMessage: message
    })
  }
})
