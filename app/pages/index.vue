<script setup lang="ts">
import { PostgrestClient } from '@supabase/postgrest-js'

interface YearStats {
  ano_eleicao: number
  total_candidatos: number
  total_municipios: number
  total_partidos: number
  total_votos: number
}

interface Candidato {
  nm_candidato: string
  nm_urna_candidato: string
  sg_partido: string
  ds_cargo: string
  ano_eleicao: number
  sg_uf: string
  qt_votos_nominais: number
  ds_sit_tot_turno: string
  nm_municipio?: string
  nr_turno?: number
  sq_candidato?: string
}

interface Partido {
  sg_partido: string
  nm_partido: string
  total_votos: number
  total_candidatos: number
}

interface UFStats {
  sg_uf: string
  total_candidatos: number
  total_votos: number
}

const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.postgrestUrl as string
const client = new PostgrestClient(apiUrl)

const loading = ref(false)
const loadingStats = ref(true)
const page = ref(1)
const candidatos = ref<Candidato[]>([])
const error = ref('')

const stats = reactive({
  byYear: [] as YearStats[],
  topCandidatos: [] as Candidato[],
  topPartidos: [] as Partido[],
  byUF: [] as UFStats[],
})

const pagination = ref({ total: 0, pages: 0, page: 1, limit: 50 })

const filters = reactive({
  candidato: '',
  partido: null as string | null,
  uf: null as string | null,
  municipio: '',
  ano: null as number | null,
  cargo: null as string | null,
  turno: null as number | null,
})

const headers = [
  { title: 'Candidato', key: 'nm_urna_candidato' },
  { title: 'Partido', key: 'sg_partido' },
  { title: 'Cargo', key: 'ds_cargo' },
  { title: 'Ano', key: 'ano_eleicao' },
  { title: 'UF', key: 'sg_uf' },
  { title: 'Município', key: 'nm_municipio' },
  { title: 'Turno', key: 'nr_turno' },
  { title: 'Total Votos', key: 'qt_votos_nominais' },
  { title: 'Situação', key: 'ds_sit_tot_turno' },
]

const estados = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const partidos = [
  'PT',
  'PL',
  'PP',
  'MDB',
  'PSDB',
  'UNIÃO',
  'PDT',
  'PSB',
  'PSD',
  'REPUBLICANOS',
  'PODE',
  'NOVO',
  'PSOL',
  'PCdoB',
  'CIDADANIA',
  'SOLIDARIEDADE',
  'AVANTE',
  'PRD',
  'REDE',
  'DC',
  'PMN',
  'AGIR',
  'PCB',
  'PSTU',
  'PCO',
  'UP',
]

const cargos = [
  'PRESIDENTE',
  'GOVERNADOR',
  'SENADOR',
  'DEPUTADO FEDERAL',
  'DEPUTADO ESTADUAL',
  'PREFEITO',
  'VEREADOR',
]

// Load initial stats via PostgREST
onMounted(async () => {
  try {
    loadingStats.value = true

    // Top Candidatos
    const { data: topCandidatos, error: errTop } = await client
      .from('votacao_candidato_munzona')
      .select('nm_candidato, nm_urna_candidato, sg_partido, ds_cargo, ano_eleicao, sg_uf, qt_votos_nominais, ds_sit_tot_turno')
      .eq('nr_turno', 1)
      .order('qt_votos_nominais', { ascending: false })
      .limit(10)

    if (errTop)
      throw errTop
    stats.topCandidatos = (topCandidatos as Candidato[]) || []

    // Busca dados para agregação - limitado para performance
    const { data: allData, error: errAll } = await client
      .from('votacao_candidato_munzona')
      .select('ano_eleicao, sq_candidato, nm_municipio, sg_partido, sg_uf, nm_partido, qt_votos_nominais')
      .limit(10000)

    if (errAll)
      throw errAll

    // Agrega por ano
    const yearMap = new Map<number, { candidatos: Set<string>, municipios: Set<string>, partidos: Set<string>, votos: number }>()
    const partidoMap = new Map<string, { nm_partido: string, votos: number, candidatos: Set<string> }>()
    const ufMap = new Map<string, { candidatos: Set<string>, votos: number }>()

    allData?.forEach((row: Record<string, unknown>) => {
      const anoEleicao = row.ano_eleicao as number
      const sqCandidato = row.sq_candidato as string
      const nmMunicipio = row.nm_municipio as string
      const sgPartido = row.sg_partido as string
      const sgUf = row.sg_uf as string
      const nmPartido = row.nm_partido as string
      const qtVotos = Number(row.qt_votos_nominais) || 0

      // Por ano
      if (!yearMap.has(anoEleicao)) {
        yearMap.set(anoEleicao, { candidatos: new Set(), municipios: new Set(), partidos: new Set(), votos: 0 })
      }
      const y = yearMap.get(anoEleicao)!
      y.candidatos.add(sqCandidato)
      y.municipios.add(nmMunicipio)
      y.partidos.add(sgPartido)
      y.votos += qtVotos

      // Por partido
      if (!partidoMap.has(sgPartido)) {
        partidoMap.set(sgPartido, { nm_partido: nmPartido, votos: 0, candidatos: new Set() })
      }
      const p = partidoMap.get(sgPartido)!
      p.votos += qtVotos
      p.candidatos.add(sqCandidato)

      // Por UF
      if (!ufMap.has(sgUf)) {
        ufMap.set(sgUf, { candidatos: new Set(), votos: 0 })
      }
      const u = ufMap.get(sgUf)!
      u.candidatos.add(sqCandidato)
      u.votos += qtVotos
    })

    stats.byYear = Array.from(yearMap.entries())
      .map(([ano, d]) => ({
        ano_eleicao: ano,
        total_candidatos: d.candidatos.size,
        total_municipios: d.municipios.size,
        total_partidos: d.partidos.size,
        total_votos: d.votos,
      }))
      .sort((a, b) => b.ano_eleicao - a.ano_eleicao)

    stats.topPartidos = Array.from(partidoMap.entries())
      .map(([sg, d]) => ({
        sg_partido: sg,
        nm_partido: d.nm_partido,
        total_votos: d.votos,
        total_candidatos: d.candidatos.size,
      }))
      .sort((a, b) => b.total_votos - a.total_votos)
      .slice(0, 10)

    stats.byUF = Array.from(ufMap.entries())
      .map(([uf, d]) => ({
        sg_uf: uf,
        total_candidatos: d.candidatos.size,
        total_votos: d.votos,
      }))
      .sort((a, b) => b.total_votos - a.total_votos)
  }
  catch (e: unknown) {
    const err = e as Error
    console.error('Error loading stats:', err)
    error.value = `Erro ao carregar estatísticas: ${err.message || err}`
  }
  finally {
    loadingStats.value = false
  }
})

async function searchCandidatos(): Promise<void> {
  loading.value = true
  error.value = ''

  try {
    const limit = 50
    const offset = (page.value - 1) * limit

    let query = client
      .from('votacao_candidato_munzona')
      .select('*', { count: 'exact' })

    if (filters.candidato) {
      query = query.ilike('nm_candidato', `%${filters.candidato}%`)
    }
    if (filters.partido) {
      query = query.eq('sg_partido', filters.partido.toUpperCase())
    }
    if (filters.uf) {
      query = query.eq('sg_uf', filters.uf.toUpperCase())
    }
    if (filters.municipio) {
      query = query.ilike('nm_municipio', `%${filters.municipio}%`)
    }
    if (filters.ano) {
      query = query.eq('ano_eleicao', filters.ano)
    }
    if (filters.cargo) {
      query = query.ilike('ds_cargo', `%${filters.cargo}%`)
    }
    if (filters.turno) {
      query = query.eq('nr_turno', filters.turno)
    }

    query = query
      .order('qt_votos_nominais', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error: err, count } = await query

    if (err)
      throw err

    candidatos.value = (data as Candidato[]) || []
    pagination.value = {
      total: count || 0,
      pages: Math.ceil((count || 0) / limit),
      page: page.value,
      limit,
    }
  }
  catch (e: unknown) {
    const err = e as Error
    console.error('Error searching:', err)
    error.value = `Erro na busca: ${err.message || err}`
  }
  finally {
    loading.value = false
  }
}

function clearFilters(): void {
  filters.candidato = ''
  filters.partido = null
  filters.uf = null
  filters.municipio = ''
  filters.ano = null
  filters.cargo = null
  filters.turno = null
  candidatos.value = []
  page.value = 1
}

function formatNumber(num: number | string): string {
  return Number(num).toLocaleString('pt-BR')
}

function formatCompact(num: number): string {
  if (num >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000)
    return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)
    return `${(num / 1_000).toFixed(1)}K`
  return String(num)
}

function getSituacaoColor(situacao: string): string {
  if (!situacao)
    return 'grey'
  const s = situacao.toUpperCase()
  if (s.includes('ELEITO') || s.includes('ELEITA'))
    return 'success'
  if (s.includes('NÃO ELEITO'))
    return 'error'
  if (s.includes('2º TURNO'))
    return 'warning'
  if (s.includes('SUPLENTE'))
    return 'info'
  return 'grey'
}

function getPartidoColor(sigla: string): string {
  const colors: Record<string, string> = {
    PT: '#CC0000',
    PL: '#003399',
    PSDB: '#0066CC',
    MDB: '#00CC00',
    PP: '#003366',
    PDT: '#FF6600',
    PSB: '#FFCC00',
    UNIÃO: '#336699',
    PSOL: '#990066',
    NOVO: '#FF6600',
    PSD: '#006633',
  }
  return colors[sigla] || '#666666'
}
</script>

<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between flex-wrap">
          <div>
            <h1 class="text-h3 font-weight-bold text-primary">
              <v-icon size="40" class="mr-3">
                mdi-vote
              </v-icon>
              Análise Política Brasil
            </h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Ferramenta de análise de dados eleitorais via PostgREST
            </p>
            <v-chip color="success" size="small" class="mt-2">
              <v-icon size="small" class="mr-1">
                mdi-api
              </v-icon>
              API: {{ apiUrl }}
            </v-chip>
          </div>
          <v-chip-group>
            <v-chip color="primary" variant="elevated">
              2018 - Gerais
            </v-chip>
            <v-chip color="secondary" variant="elevated">
              2020 - Municipais
            </v-chip>
            <v-chip color="primary" variant="elevated">
              2022 - Gerais
            </v-chip>
            <v-chip color="secondary" variant="elevated">
              2024 - Municipais
            </v-chip>
          </v-chip-group>
        </div>
      </v-col>
    </v-row>

    <!-- Loading Stats -->
    <v-row v-if="loadingStats" class="mb-6">
      <v-col cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" size="60" />
        <p class="mt-4 text-medium-emphasis">
          Carregando estatísticas...
        </p>
      </v-col>
    </v-row>

    <!-- Stats Cards -->
    <v-row v-if="stats.byYear.length > 0" class="mb-6">
      <v-col v-for="yearData in stats.byYear" :key="yearData.ano_eleicao" cols="12" sm="6" md="3">
        <v-card
          :color="yearData.ano_eleicao % 4 === 0 ? 'secondary' : 'primary'"
          class="elevation-8 rounded-xl"
        >
          <v-card-text class="text-center text-white pa-6">
            <div class="d-flex align-center justify-center mb-3">
              <v-icon size="32" class="mr-2">
                {{ yearData.ano_eleicao % 4 === 0 ? 'mdi-city' : 'mdi-domain' }}
              </v-icon>
              <span class="text-h4 font-weight-bold">{{ yearData.ano_eleicao }}</span>
            </div>
            <v-chip color="white" text-color="primary" class="mb-3" size="small">
              {{ yearData.ano_eleicao % 4 === 0 ? 'Municipais' : 'Gerais' }}
            </v-chip>
            <div class="text-h5 font-weight-bold">
              {{ formatNumber(yearData.total_votos) }}
            </div>
            <div class="text-caption">
              votos registrados
            </div>
            <v-divider class="my-3 opacity-50" />
            <div class="d-flex justify-space-around text-caption">
              <div>
                <strong>{{ formatNumber(yearData.total_candidatos) }}</strong><br>
                candidatos
              </div>
              <div>
                <strong>{{ formatNumber(yearData.total_municipios) }}</strong><br>
                municípios
              </div>
              <div>
                <strong>{{ yearData.total_partidos }}</strong><br>
                partidos
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Search & Filters -->
    <v-card class="mb-6 rounded-xl elevation-4">
      <v-card-title class="bg-primary text-white py-4">
        <v-icon class="mr-2">
          mdi-magnify
        </v-icon>
        Buscar Candidatos
      </v-card-title>
      <v-card-text class="pa-6">
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="filters.candidato"
              label="Nome do Candidato"
              prepend-inner-icon="mdi-account-search"
              variant="outlined"
              density="comfortable"
              clearable
              @keyup.enter="searchCandidatos"
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.partido"
              :items="partidos"
              label="Partido"
              prepend-inner-icon="mdi-flag"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.uf"
              :items="estados"
              label="Estado (UF)"
              prepend-inner-icon="mdi-map-marker"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.ano"
              :items="[2024, 2022, 2020, 2018]"
              label="Ano"
              prepend-inner-icon="mdi-calendar"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.cargo"
              :items="cargos"
              label="Cargo"
              prepend-inner-icon="mdi-briefcase"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="filters.municipio"
              label="Município"
              prepend-inner-icon="mdi-city-variant"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-select
              v-model="filters.turno"
              :items="[{ title: '1º Turno', value: 1 }, { title: '2º Turno', value: 2 }]"
              label="Turno"
              prepend-inner-icon="mdi-numeric"
              variant="outlined"
              density="comfortable"
              clearable
            />
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-btn
              color="primary"
              size="large"
              :loading="loading"
              class="mr-4"
              @click="searchCandidatos"
            >
              <v-icon class="mr-2">
                mdi-magnify
              </v-icon>
              Buscar
            </v-btn>
            <v-btn
              variant="outlined"
              size="large"
              @click="clearFilters"
            >
              <v-icon class="mr-2">
                mdi-filter-off
              </v-icon>
              Limpar Filtros
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Results Table -->
    <v-card v-if="candidatos.length > 0" class="rounded-xl elevation-4 mb-6">
      <v-card-title class="bg-secondary text-white py-4 d-flex justify-space-between">
        <div>
          <v-icon class="mr-2">
            mdi-table
          </v-icon>
          Resultados
        </div>
        <v-chip color="white" text-color="secondary">
          {{ formatNumber(pagination.total) }} registros encontrados
        </v-chip>
      </v-card-title>
      <v-data-table
        :headers="headers"
        :items="candidatos"
        :loading="loading"
        :items-per-page="50"
        class="elevation-0"
      >
        <template #[`item.qt_votos_nominais`]="{ item }">
          <v-chip color="success" variant="elevated" size="small">
            <v-icon size="small" class="mr-1">
              mdi-vote
            </v-icon>
            {{ formatNumber(item.qt_votos_nominais) }}
          </v-chip>
        </template>

        <template #[`item.ds_sit_tot_turno`]="{ item }">
          <v-chip
            :color="getSituacaoColor(item.ds_sit_tot_turno)"
            size="small"
            variant="elevated"
          >
            {{ item.ds_sit_tot_turno }}
          </v-chip>
        </template>

        <template #[`item.ano_eleicao`]="{ item }">
          <v-chip
            :color="item.ano_eleicao % 4 === 0 ? 'secondary' : 'primary'"
            size="small"
            variant="outlined"
          >
            {{ item.ano_eleicao }}
          </v-chip>
        </template>

        <template #[`item.sg_partido`]="{ item }">
          <v-chip color="info" size="small" variant="tonal">
            {{ item.sg_partido }}
          </v-chip>
        </template>
      </v-data-table>

      <!-- Pagination -->
      <v-card-actions class="pa-4">
        <v-pagination
          v-model="page"
          :length="pagination.pages"
          :total-visible="7"
          @update:model-value="searchCandidatos"
        />
      </v-card-actions>
    </v-card>

    <!-- Top Candidatos e Partidos -->
    <v-row v-if="stats.topCandidatos.length > 0" class="mt-6">
      <v-col cols="12" md="6">
        <v-card class="rounded-xl elevation-4 h-100">
          <v-card-title class="bg-gradient-primary text-white py-4">
            <v-icon class="mr-2">
              mdi-trophy
            </v-icon>
            Top 10 Candidatos Mais Votados
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="(candidato, index) in stats.topCandidatos"
              :key="index"
              class="py-3"
            >
              <template #prepend>
                <v-avatar
                  :color="index < 3 ? 'amber' : 'grey-lighten-2'"
                  size="36"
                >
                  <span class="font-weight-bold">{{ index + 1 }}</span>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-bold">
                {{ candidato.nm_urna_candidato || candidato.nm_candidato }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ candidato.sg_partido }} · {{ candidato.ds_cargo }} · {{ candidato.sg_uf }} · {{ candidato.ano_eleicao }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip color="success" size="small" variant="elevated">
                  {{ formatNumber(candidato.qt_votos_nominais) }} votos
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card class="rounded-xl elevation-4 h-100">
          <v-card-title class="bg-gradient-secondary text-white py-4">
            <v-icon class="mr-2">
              mdi-flag
            </v-icon>
            Top 10 Partidos por Votos
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="(partido, index) in stats.topPartidos"
              :key="index"
              class="py-3"
            >
              <template #prepend>
                <v-avatar
                  :color="getPartidoColor(partido.sg_partido)"
                  size="36"
                >
                  <span class="font-weight-bold text-white text-caption">{{ partido.sg_partido }}</span>
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-bold">
                {{ partido.nm_partido }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ formatNumber(partido.total_candidatos) }} candidatos
              </v-list-item-subtitle>
              <template #append>
                <v-chip color="primary" size="small" variant="elevated">
                  {{ formatNumber(partido.total_votos) }} votos
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>

    <!-- UF Stats -->
    <v-row v-if="stats.byUF.length > 0" class="mt-6">
      <v-col cols="12">
        <v-card class="rounded-xl elevation-4">
          <v-card-title class="bg-info text-white py-4">
            <v-icon class="mr-2">
              mdi-map
            </v-icon>
            Votos por Estado
          </v-card-title>
          <v-card-text class="pa-4">
            <v-row>
              <v-col
                v-for="uf in stats.byUF.slice(0, 12)"
                :key="uf.sg_uf"
                cols="6"
                sm="4"
                md="2"
              >
                <v-card variant="outlined" class="text-center pa-3">
                  <div class="text-h6 font-weight-bold text-primary">
                    {{ uf.sg_uf }}
                  </div>
                  <div class="text-body-2">
                    {{ formatCompact(uf.total_votos) }} votos
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ formatNumber(uf.total_candidatos) }} candidatos
                  </div>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Error Alert -->
    <v-alert v-if="error" type="error" class="mt-4" closable @click:close="error = ''">
      {{ error }}
    </v-alert>
  </v-container>
</template>

<style scoped>
.bg-gradient-primary {
  background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
}
.bg-gradient-secondary {
  background: linear-gradient(135deg, #7b1fa2 0%, #6a1b9a 100%);
}
</style>
