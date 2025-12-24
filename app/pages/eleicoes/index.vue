<template>
  <v-container fluid class="pa-6">
    <!-- Header -->
    <v-row class="mb-6">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div>
            <h1 class="text-h3 font-weight-bold text-primary">
              <v-icon size="40" class="mr-3">mdi-vote</v-icon>
              Análise Eleitoral Brasil
            </h1>
            <p class="text-subtitle-1 text-medium-emphasis mt-2">
              Dados do TSE: Eleições 2018, 2020, 2022 e 2024
            </p>
          </div>
          <v-chip-group>
            <v-chip color="primary" variant="elevated">2018 - Gerais</v-chip>
            <v-chip color="secondary" variant="elevated">2020 - Municipais</v-chip>
            <v-chip color="primary" variant="elevated">2022 - Gerais</v-chip>
            <v-chip color="secondary" variant="elevated">2024 - Municipais</v-chip>
          </v-chip-group>
        </div>
      </v-col>
    </v-row>

    <!-- Stats Cards -->
    <v-row v-if="stats" class="mb-6">
      <v-col cols="12" md="3" v-for="(yearData, index) in stats.byYear" :key="yearData.ano_eleicao">
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
            <div class="text-caption">votos registrados</div>
            <v-divider class="my-3 opacity-50"></v-divider>
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
        <v-icon class="mr-2">mdi-magnify</v-icon>
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
            ></v-text-field>
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
            ></v-select>
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
            ></v-select>
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
            ></v-select>
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
            ></v-select>
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
            ></v-text-field>
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
            ></v-select>
          </v-col>
          <v-col cols="12" md="6" class="d-flex align-center">
            <v-btn 
              color="primary" 
              size="large" 
              @click="searchCandidatos"
              :loading="loading"
              class="mr-4"
            >
              <v-icon class="mr-2">mdi-magnify</v-icon>
              Buscar
            </v-btn>
            <v-btn 
              variant="outlined" 
              size="large" 
              @click="clearFilters"
            >
              <v-icon class="mr-2">mdi-filter-off</v-icon>
              Limpar Filtros
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Results Table -->
    <v-card v-if="candidatos.length > 0" class="rounded-xl elevation-4">
      <v-card-title class="bg-secondary text-white py-4 d-flex justify-space-between">
        <div>
          <v-icon class="mr-2">mdi-table</v-icon>
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
        <template v-slot:item.total_votos="{ item }">
          <v-chip color="success" variant="elevated" size="small">
            <v-icon size="small" class="mr-1">mdi-vote</v-icon>
            {{ formatNumber(item.total_votos) }}
          </v-chip>
        </template>
        
        <template v-slot:item.ds_sit_tot_turno="{ item }">
          <v-chip 
            :color="getSituacaoColor(item.ds_sit_tot_turno)" 
            size="small"
            variant="elevated"
          >
            {{ item.ds_sit_tot_turno }}
          </v-chip>
        </template>
        
        <template v-slot:item.ano_eleicao="{ item }">
          <v-chip 
            :color="item.ano_eleicao % 4 === 0 ? 'secondary' : 'primary'" 
            size="small"
            variant="outlined"
          >
            {{ item.ano_eleicao }}
          </v-chip>
        </template>
        
        <template v-slot:item.sg_partido="{ item }">
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
        ></v-pagination>
      </v-card-actions>
    </v-card>

    <!-- Top Candidatos -->
    <v-row v-if="stats" class="mt-6">
      <v-col cols="12" md="6">
        <v-card class="rounded-xl elevation-4 h-100">
          <v-card-title class="bg-gradient-primary text-white py-4">
            <v-icon class="mr-2">mdi-trophy</v-icon>
            Top 10 Candidatos Mais Votados
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="(candidato, index) in stats.topCandidatos"
              :key="index"
              class="py-3"
            >
              <template v-slot:prepend>
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
              <template v-slot:append>
                <v-chip color="success" size="small" variant="elevated">
                  {{ formatNumber(candidato.total_votos) }} votos
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
      
      <v-col cols="12" md="6">
        <v-card class="rounded-xl elevation-4 h-100">
          <v-card-title class="bg-gradient-secondary text-white py-4">
            <v-icon class="mr-2">mdi-flag</v-icon>
            Top 10 Partidos por Votos
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="(partido, index) in stats.topPartidos"
              :key="index"
              class="py-3"
            >
              <template v-slot:prepend>
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
              <template v-slot:append>
                <v-chip color="primary" size="small" variant="elevated">
                  {{ formatNumber(partido.total_votos) }} votos
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const loading = ref(false)
const page = ref(1)
const candidatos = ref<any[]>([])
const stats = ref<any>(null)
const pagination = ref({ total: 0, pages: 0 })

const filters = reactive({
  candidato: '',
  partido: null,
  uf: null,
  municipio: '',
  ano: null,
  cargo: null,
  turno: null,
})

const headers = [
  { title: 'Candidato', key: 'nm_urna_candidato' },
  { title: 'Partido', key: 'sg_partido' },
  { title: 'Cargo', key: 'ds_cargo' },
  { title: 'Ano', key: 'ano_eleicao' },
  { title: 'UF', key: 'sg_uf' },
  { title: 'Município', key: 'nm_municipio' },
  { title: 'Turno', key: 'nr_turno' },
  { title: 'Total Votos', key: 'total_votos' },
  { title: 'Situação', key: 'ds_sit_tot_turno' },
]

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
]

const partidos = [
  'PT', 'PL', 'PP', 'MDB', 'PSDB', 'UNIÃO', 'PDT', 'PSB', 'PSD', 'REPUBLICANOS',
  'PODE', 'NOVO', 'PSOL', 'PCdoB', 'CIDADANIA', 'SOLIDARIEDADE', 'AVANTE', 
  'PRD', 'REDE', 'DC', 'PMN', 'AGIR', 'PCB', 'PSTU', 'PCO', 'UP'
]

const cargos = [
  'PRESIDENTE', 'GOVERNADOR', 'SENADOR', 'DEPUTADO FEDERAL', 
  'DEPUTADO ESTADUAL', 'PREFEITO', 'VEREADOR'
]

// Load initial stats
onMounted(async () => {
  try {
    const response = await $fetch('/api/eleicoes/stats')
    if (response.success) {
      stats.value = response.stats
    }
  } catch (error) {
    console.error('Error loading stats:', error)
  }
})

async function searchCandidatos() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filters.candidato) params.set('candidato', filters.candidato)
    if (filters.partido) params.set('partido', filters.partido)
    if (filters.uf) params.set('uf', filters.uf)
    if (filters.municipio) params.set('municipio', filters.municipio)
    if (filters.ano) params.set('ano', String(filters.ano))
    if (filters.cargo) params.set('cargo', filters.cargo)
    if (filters.turno) params.set('turno', String(filters.turno))
    params.set('page', String(page.value))
    params.set('limit', '50')
    
    const response = await $fetch(`/api/eleicoes/candidatos?${params.toString()}`)
    if (response.success) {
      candidatos.value = response.data
      pagination.value = response.pagination
    }
  } catch (error) {
    console.error('Error searching:', error)
  } finally {
    loading.value = false
  }
}

function clearFilters() {
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

function getSituacaoColor(situacao: string): string {
  if (!situacao) return 'grey'
  const s = situacao.toUpperCase()
  if (s.includes('ELEITO') || s.includes('ELEITA')) return 'success'
  if (s.includes('NÃO ELEITO')) return 'error'
  if (s.includes('2º TURNO')) return 'warning'
  if (s.includes('SUPLENTE')) return 'info'
  return 'grey'
}

function getPartidoColor(sigla: string): string {
  const colors: Record<string, string> = {
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
  }
  return colors[sigla] || '#666666'
}
</script>

<style scoped>
.bg-gradient-primary {
  background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
}
.bg-gradient-secondary {
  background: linear-gradient(135deg, #7B1FA2 0%, #6A1B9A 100%);
}
</style>
