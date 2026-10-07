<script setup lang="ts">
import { ANOS_COM_LOCAIS } from '~/data/eleicoes'
import { tituloLocal } from '~/utils/locais'

/**
 * Onde o candidato foi mais votado: escola (local de votação), bairro e região.
 * ?ano= escolhe a eleição (padrão: a mais recente) e ?municipio= filtra tudo.
 */
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const ano = computed<number | null>(() => {
  const valor = Number(route.query.ano)
  return ANOS_COM_LOCAIS.includes(valor) ? valor : null
})

const {
  pronto,
  data,
  status,
  error,
  municipio,
  municipioSelecionado,
  locais,
  totalVotos,
  bairros,
  areas,
  zonas,
  microrregioes,
  mesorregioes,
} = useCandidatoLocais(slug, ano)
if (import.meta.server)
  await pronto

if (import.meta.server && error.value?.statusCode === 404)
  throw createError({ statusCode: 404, statusMessage: 'Candidato não encontrado', fatal: true })

const aba = ref<'escolas' | 'bairros' | 'regioes'>('escolas')
const busca = ref('')

const nome = computed(() => data.value?.nm_urna_candidato ?? 'Candidato')
const escolaTop = computed(() => locais.value[0])
const bairroTop = computed(() => bairros.value[0])
const linkPerfil = computed(() => ({ path: `/candidato/${slug.value}`, query: data.value ? { ano: String(data.value.ano) } : {} }))

const municipiosOpcoes = computed(() => (data.value?.municipios ?? []).map(m => ({
  title: m.nome,
  value: m.nome,
  subtitle: `${m.votos.toLocaleString('pt-BR')} votos · ${m.locais} ${m.locais === 1 ? 'local' : 'locais'}`,
})))

// Tabela de escolas: posição fixa no ranking, mesmo com busca ou outra ordenação
const escolas = computed(() => locais.value.map((l, i) => ({ ...l, posicao: i + 1, nomeExibicao: tituloLocal(l.local) })))
const cabecalhosEscolas = [
  { title: '#', key: 'posicao', width: 48, sortable: false },
  { title: 'Escola', key: 'nomeExibicao', sortable: false },
  { title: 'Votos', key: 'votos', align: 'end' as const },
  { title: '% local', key: 'pctLocal', align: 'end' as const },
]
const cabecalhosBairros = computed(() => [
  { title: 'Bairro', key: 'nome' },
  ...(municipio.value ? [] : [{ title: 'Município', key: 'municipio' }]),
  { title: 'Locais', key: 'locais', align: 'end' as const },
  { title: 'Votos', key: 'votos', align: 'end' as const },
  { title: '% do total', key: 'pctTotal', align: 'end' as const },
])

function filtrarEscola(_valor: unknown, termo: string, item?: { raw: { local: string, bairro: string, municipio: string } }) {
  if (!item)
    return false
  const alvo = `${item.raw.local} ${item.raw.bairro} ${item.raw.municipio}`.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return alvo.includes(termo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase())
}

function goBack() {
  router.push(linkPerfil.value)
}

const tituloSeo = computed(() => data.value
  ? `Onde ${data.value.nm_urna_candidato} foi mais votado em ${data.value.ano} — escolas e bairros`
  : 'Votos por escola e bairro')
const descricaoSeo = computed(() => data.value?.disponivel
  ? `Votos de ${data.value.nm_urna_candidato} (${data.value.ds_cargo}, ${data.value.sg_partido}) em ${data.value.ano} por local de votação: ${data.value.locais.length} escolas em ${data.value.municipios.length} municípios. Mapa, ranking de bairros e regiões.`
  : 'Votos do candidato por local de votação, bairro e região.')
useSeoMeta({
  title: tituloSeo,
  description: descricaoSeo,
  ogTitle: tituloSeo,
  ogDescription: descricaoSeo,
  twitterTitle: tituloSeo,
  twitterDescription: descricaoSeo,
})
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <v-app-bar flat color="surface" elevation="1">
      <v-btn icon="mdi-arrow-left" aria-label="Voltar ao perfil" @click="goBack" />
      <v-app-bar-title class="text-body-1">
        {{ nome }} · por escola
      </v-app-bar-title>
    </v-app-bar>

    <div v-if="status === 'pending' || (status === 'idle' && !data)" class="flex-grow-1 d-flex align-center justify-center">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <div v-else-if="error || !data" class="flex-grow-1 d-flex flex-column align-center justify-center pa-4">
      <v-icon size="64" color="error" class="mb-4">
        mdi-map-marker-alert
      </v-icon>
      <p class="text-h6 text-center mb-2">
        Não foi possível carregar os votos por escola
      </p>
      <v-btn color="primary" variant="tonal" @click="goBack">
        Voltar
      </v-btn>
    </div>

    <div v-else-if="!data.disponivel" class="flex-grow-1 d-flex flex-column align-center justify-center pa-4 bg-grey-lighten-4">
      <v-icon size="56" color="grey" class="mb-4">
        mdi-school-outline
      </v-icon>
      <p class="text-h6 text-center mb-2">
        Sem votos por escola para esta eleição
      </p>
      <p class="text-body-2 text-medium-emphasis text-center mb-4" style="max-width: 420px;">
        O detalhamento por local de votação está disponível para a eleição de {{ ANOS_COM_LOCAIS.join(', ') }} em Pernambuco (1º turno).
      </p>
      <v-btn color="primary" variant="tonal" :to="linkPerfil">
        Ver perfil do candidato
      </v-btn>
    </div>

    <div v-else class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Cabeçalho -->
      <v-card flat class="rounded-0">
        <v-card-text class="pa-4">
          <h1 class="text-h6 font-weight-bold mb-1">
            Onde {{ data.nm_urna_candidato }} foi mais votado
          </h1>
          <p class="text-body-2 text-medium-emphasis mb-0">
            {{ data.ds_cargo }} · {{ data.sg_partido }} · Eleição {{ data.ano }}, 1º turno
          </p>
        </v-card-text>
      </v-card>

      <!-- Filtro de município -->
      <div class="px-4 pt-4">
        <v-autocomplete
          v-model="municipio"
          :items="municipiosOpcoes"
          label="Município"
          placeholder="Todos os municípios"
          prepend-inner-icon="mdi-city-variant-outline"
          variant="solo"
          flat
          density="comfortable"
          rounded="lg"
          clearable
          persistent-placeholder
          hide-details
          :item-props="true"
        />
      </div>

      <!-- Números -->
      <div class="px-4 pt-3">
        <v-row dense>
          <v-col cols="6" sm="3">
            <v-card variant="flat" rounded="lg" class="pa-3 h-100">
              <p class="text-caption text-medium-emphasis mb-1">
                Votos{{ municipio ? ` em ${municipioSelecionado?.nome}` : '' }}
              </p>
              <p class="text-h6 font-weight-bold mb-0">
                {{ totalVotos.toLocaleString('pt-BR') }}
              </p>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="flat" rounded="lg" class="pa-3 h-100">
              <p class="text-caption text-medium-emphasis mb-1">
                Locais com voto
              </p>
              <p class="text-h6 font-weight-bold mb-0">
                {{ locais.length.toLocaleString('pt-BR') }}
              </p>
            </v-card>
          </v-col>
          <v-col cols="12" sm="3">
            <v-card variant="flat" rounded="lg" class="pa-3 h-100">
              <p class="text-caption text-medium-emphasis mb-1">
                Escola com mais votos
              </p>
              <p class="text-body-2 font-weight-bold mb-0">
                {{ escolaTop ? tituloLocal(escolaTop.local) : '—' }}
              </p>
              <p v-if="escolaTop" class="text-caption text-medium-emphasis mb-0">
                {{ escolaTop.votos.toLocaleString('pt-BR') }} votos · {{ escolaTop.municipio }}
              </p>
            </v-card>
          </v-col>
          <v-col cols="12" sm="3">
            <v-card variant="flat" rounded="lg" class="pa-3 h-100">
              <p class="text-caption text-medium-emphasis mb-1">
                Bairro com mais votos
              </p>
              <p class="text-body-2 font-weight-bold mb-0">
                {{ bairroTop?.nome ?? '—' }}
              </p>
              <p v-if="bairroTop" class="text-caption text-medium-emphasis mb-0">
                {{ bairroTop.votos.toLocaleString('pt-BR') }} votos · {{ bairroTop.municipio }}
              </p>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Mapa -->
      <div class="px-4 pt-4">
        <p class="text-overline text-medium-emphasis mb-2">
          <v-icon size="16" class="mr-1">
            mdi-map-marker-radius
          </v-icon>
          Mapa das escolas
        </p>
        <v-card variant="flat" rounded="lg" class="pa-3">
          <CandidatoLocaisMapa
            :locais="locais"
            :municipio="municipioSelecionado"
            @municipio="municipio = $event"
          />
        </v-card>
      </div>

      <!-- Abas -->
      <div class="px-4 pt-4 pb-4">
        <v-card variant="flat" rounded="lg">
          <v-tabs v-model="aba" color="primary" grow class="abas-locais">
            <v-tab value="escolas" prepend-icon="mdi-school-outline">
              Escolas
            </v-tab>
            <v-tab value="bairros" prepend-icon="mdi-home-group">
              Bairros
            </v-tab>
            <v-tab value="regioes" prepend-icon="mdi-map-outline">
              Regiões
            </v-tab>
          </v-tabs>
          <v-divider />

          <v-tabs-window v-model="aba">
            <!-- Escolas -->
            <v-tabs-window-item value="escolas">
              <div class="pa-3">
                <v-text-field
                  v-model="busca"
                  placeholder="Buscar escola, bairro ou município"
                  prepend-inner-icon="mdi-magnify"
                  variant="outlined"
                  density="compact"
                  rounded="lg"
                  clearable
                  hide-details
                />
              </div>
              <v-data-table
                :headers="cabecalhosEscolas"
                :items="escolas"
                :search="busca ?? ''"
                :custom-filter="filtrarEscola"
                :items-per-page="25"
                :sort-by="[{ key: 'votos', order: 'desc' }]"
                item-value="id"
                class="tabela-locais"
                density="compact"
                :mobile="false"
                items-per-page-text="Por página"
                no-data-text="Nenhuma escola encontrada"
              >
                <template #[`item.nomeExibicao`]="{ item }">
                  <div class="py-2">
                    <p class="text-body-2 font-weight-medium mb-0">
                      {{ item.nomeExibicao }}
                    </p>
                    <p class="text-caption text-medium-emphasis mb-0">
                      {{ item.bairro }}<template v-if="!municipio">
                        · {{ item.municipio }}
                      </template> · zona {{ item.zona }}
                    </p>
                  </div>
                </template>
                <template #[`item.votos`]="{ item }">
                  <span class="font-weight-bold">{{ item.votos.toLocaleString('pt-BR') }}</span>
                </template>
                <template #[`item.pctLocal`]="{ item }">
                  {{ item.pctLocal.toFixed(1) }}%
                </template>
              </v-data-table>
            </v-tabs-window-item>

            <!-- Bairros -->
            <v-tabs-window-item value="bairros">
              <div class="pa-3">
                <p class="text-body-2 font-weight-medium mb-2">
                  Bairros com mais votos
                </p>
                <CandidatoLocaisBarras
                  :itens="bairros"
                  titulo="Votos por bairro"
                  :com-municipio="!municipio"
                />
              </div>
              <v-divider />
              <v-data-table
                :headers="cabecalhosBairros"
                :items="bairros"
                :items-per-page="25"
                :item-value="(b: { municipio?: string, nome: string }) => `${b.municipio}|${b.nome}`"
                class="tabela-locais"
                density="compact"
                :mobile="false"
                items-per-page-text="Por página"
              >
                <template #[`item.votos`]="{ item }">
                  <span class="font-weight-bold">{{ item.votos.toLocaleString('pt-BR') }}</span>
                </template>
                <template #[`item.pctTotal`]="{ item }">
                  {{ item.pctTotal.toFixed(1) }}%
                </template>
              </v-data-table>
            </v-tabs-window-item>

            <!-- Regiões -->
            <v-tabs-window-item value="regioes">
              <div class="pa-3">
                <p class="text-body-2 font-weight-medium mb-0">
                  Sede, distritos e zona rural
                </p>
                <p class="text-caption text-medium-emphasis mb-2">
                  Pelo bairro que o TSE registra para cada escola.
                </p>
                <CandidatoLocaisBarras :itens="areas" titulo="Votos por tipo de área" />

                <template v-if="!municipio">
                  <p class="text-body-2 font-weight-medium mt-5 mb-2">
                    Mesorregiões (IBGE)
                  </p>
                  <CandidatoLocaisBarras :itens="mesorregioes" titulo="Votos por mesorregião" />

                  <p class="text-body-2 font-weight-medium mt-5 mb-2">
                    Microrregiões (IBGE)
                  </p>
                  <CandidatoLocaisBarras :itens="microrregioes" titulo="Votos por microrregião" />
                </template>

                <p class="text-body-2 font-weight-medium mt-5 mb-2">
                  Zonas eleitorais
                </p>
                <CandidatoLocaisBarras :itens="zonas" titulo="Votos por zona eleitoral" :com-municipio="!municipio" />
              </div>
            </v-tabs-window-item>
          </v-tabs-window>
        </v-card>

        <v-card rounded="lg" elevation="0" class="mt-3 pa-3" color="grey-lighten-3">
          <div class="d-flex">
            <v-icon color="info" size="18" class="mr-2 mt-1">
              mdi-information-outline
            </v-icon>
            <span class="text-caption text-medium-emphasis">
              Fonte: TSE, votação por seção e cadastro de locais de votação de {{ data.ano }} (1º turno), somados por escola.
              "% no local" é a fatia dos votos válidos daquela escola para o cargo que foi para {{ data.nm_urna_candidato }}.
              Nenhum dado por seção ou por eleitor é exibido.
            </span>
          </div>
        </v-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No celular a tabela precisa de cada pixel: menos respiro lateral nas células */
@media (max-width: 599px) {
  .tabela-locais :deep(th),
  .tabela-locais :deep(td) {
    padding-left: 6px !important;
    padding-right: 6px !important;
  }
  /* sem ícone nas abas, senão "Regiões" não cabe */
  .abas-locais :deep(.v-btn__prepend) {
    display: none;
  }
}
</style>
