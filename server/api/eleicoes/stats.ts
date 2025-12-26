import postgres from 'postgres'

function getDB() {
  const config = useRuntimeConfig()
  
  const connectionString = config.databaseUrl || import.meta.env.DATABASE_URL
  
  if (connectionString) {
    return postgres(connectionString, { max: 5 })
  }
  
  return postgres({
    host: config.pgHost,
    port: Number.parseInt(config.pgPort || '5423'),
    username: config.pgUser,
    password: config.pgPassword,
    database: config.pgDatabase,
    max: 5,
  })
}

export default defineEventHandler(async () => {
  const sql = getDB()
  
  try {
    // Estatísticas gerais por ano
    const byYear = await sql`
      SELECT 
        ano_eleicao,
        COUNT(DISTINCT sq_candidato) as total_candidatos,
        COUNT(DISTINCT nm_municipio) as total_municipios,
        COUNT(DISTINCT sg_partido) as total_partidos,
        SUM(qt_votos_nominais) as total_votos
      FROM votacao_candidato_munzona
      GROUP BY ano_eleicao
      ORDER BY ano_eleicao DESC
    `
    
    // Top 10 partidos por votos
    const topPartidos = await sql`
      SELECT 
        sg_partido,
        nm_partido,
        SUM(qt_votos_nominais) as total_votos,
        COUNT(DISTINCT sq_candidato) as total_candidatos
      FROM votacao_candidato_munzona
      GROUP BY sg_partido, nm_partido
      ORDER BY total_votos DESC
      LIMIT 10
    `
    
    // Estatísticas por tipo de cargo
    const byCargo = await sql`
      SELECT 
        ds_cargo,
        ano_eleicao,
        COUNT(DISTINCT sq_candidato) as total_candidatos,
        SUM(qt_votos_nominais) as total_votos
      FROM votacao_candidato_munzona
      GROUP BY ds_cargo, ano_eleicao
      ORDER BY ano_eleicao DESC, total_votos DESC
    `
    
    // Top 10 candidatos mais votados
    const topCandidatos = await sql`
      SELECT 
        nm_candidato,
        nm_urna_candidato,
        sg_partido,
        ds_cargo,
        ano_eleicao,
        sg_uf,
        SUM(qt_votos_nominais) as total_votos,
        ds_sit_tot_turno
      FROM votacao_candidato_munzona
      WHERE nr_turno = 1
      GROUP BY nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, ds_sit_tot_turno
      ORDER BY total_votos DESC
      LIMIT 10
    `
    
    // Por UF
    const byUF = await sql`
      SELECT 
        sg_uf,
        COUNT(DISTINCT sq_candidato) as total_candidatos,
        SUM(qt_votos_nominais) as total_votos
      FROM votacao_candidato_munzona
      GROUP BY sg_uf
      ORDER BY total_votos DESC
    `
    
    await sql.end()
    
    return {
      success: true,
      stats: {
        byYear,
        topPartidos,
        byCargo,
        topCandidatos,
        byUF
      },
      electionInfo: {
        2018: { type: 'Gerais', description: 'Presidente, Governador, Senador, Deputados' },
        2020: { type: 'Municipais', description: 'Prefeito, Vereador' },
        2022: { type: 'Gerais', description: 'Presidente, Governador, Senador, Deputados' },
        2024: { type: 'Municipais', description: 'Prefeito, Vereador' },
      }
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
