# Instruções do GitHub Copilot para o Projeto CIA On-Site

## Visão Geral

Plataforma de análise de dados eleitorais brasileiros (TSE). **Nuxt 4** + **Vuetify 3** com dados via **PostgREST API** e deploy na **Cloudflare Pages**.

## ⚠️ Regras Críticas

### Gerenciador de Pacotes: SEMPRE use Bun
```bash
bun install          # ✅ CORRETO
bun add <pacote>@latest
npm install          # ❌ NUNCA USE npm/yarn/pnpm
```

### TypeScript Estrito
- Zero erros tolerados (`bun run typecheck` deve passar)
- Evite `any` - use tipos específicos ou `unknown`
- Defina interfaces em `app/data/eleicoes.ts` para tipos de domínio

## Arquitetura de Dados (Dual-Path)

O projeto tem **dois caminhos de acesso a dados** - escolha baseado no contexto:

### 1. PostgREST Direto (Cliente) - `usePostgrest.ts`
Para buscas simples com `@supabase/postgrest-js`:
```typescript
const { client } = usePostgrest()
const { data } = await client
  .from('mv_votos_candidato')  // ← Prefira views materializadas (mv_*)
  .select('nm_candidato, sg_partido, total_votos')
  .ilike('nm_candidato', `%${termo}%`)
  .order('total_votos', { ascending: false })
  .limit(50)
```

### 2. Proxy API (Servidor) - `useEleicoes.ts`
Para evitar CORS e queries complexas via `/api/proxy`:
```typescript
const { searchCandidatos, getStatsAno } = useEleicoes()
const candidatos = await searchCandidatos({ uf: 'SP', ano: 2024 })
```

### Views Materializadas Disponíveis
| View | Uso |
|------|-----|
| `mv_votos_candidato` | Busca de candidatos (agregada) |
| `mv_stats_ano` | Estatísticas por ano |
| `mv_stats_partido` | Estatísticas por partido |
| `mv_top_candidatos` | Top candidatos por votos |

**Fallback**: Se a view não existir, use `votacao_candidato_munzona` (tabela base).

## Estrutura do Projeto

```
app/
├── composables/
│   ├── usePostgrest.ts       # Cliente PostgREST direto
│   ├── useEleicoes.ts        # API via proxy (recomendado)
│   ├── useCandidatoSearch.ts # Busca de candidatos (estado, filtros, agregação)
│   ├── useCidadesFilter.ts   # Carrega cidades por UF/ano
│   └── useGeolocalizacao.ts  # Geolocalização via IP (SSR)
├── data/eleicoes.ts          # Constantes + Types (ESTADOS, PARTIDOS, CARGOS)
├── utils/formatters.ts       # Funções utilitárias (formatNumber, getSituacaoColor)
└── pages/index.vue           # Dashboard principal
server/api/
├── proxy/[...path].ts        # Proxy CORS para PostgREST
├── geo.ts                    # Geolocalização por IP
└── eleicoes/                 # Endpoints diretos PostgreSQL (Cloudflare Hyperdrive)
```

## Composables Disponíveis

| Composable | Responsabilidade |
|------------|------------------|
| `useCandidatoSearch()` | Busca completa: estado, filtros, validação, agregação de votos |
| `useCidadesFilter()` | Carrega lista de cidades por UF para eleições municipais |
| `useGeolocalizacao()` | Detecta estado do usuário via IP (usa `useAsyncData` SSR) |
| `usePostgrest()` | Cliente PostgREST direto para queries simples |
| `useEleicoes()` | API via proxy para queries complexas |

### Exemplo de Uso (Padrão Nuxt 4)
```typescript
// Composables são auto-importados
const { candidatos, search, filters, canSearch } = useCandidatoSearch()
const { cidades, loadCidades } = useCidadesFilter()
const { estadoDetectado } = useGeolocalizacao()

// Auto-preencher UF baseado em geolocalização
watchEffect(() => {
  if (estadoDetectado.value && filters.uf === null) {
    filters.uf = estadoDetectado.value
  }
})
```

## Padrões de Código Vue

### Separação de Responsabilidades
- **Composables**: Lógica de negócio, estado reativo, chamadas API
- **Utils**: Funções puras de formatação/transformação
- **Componentes**: Apenas UI e handlers de eventos

```vue
<script setup lang="ts">
// 1. Imports de dados/tipos
import { ANOS_ELEICAO, ESTADOS } from '~/data/eleicoes'
import { formatNumber, getSituacaoColor } from '~/utils/formatters'

// 2. Composables (auto-importados)
const { candidatos, search, filters } = useCandidatoSearch()
const { estadoDetectado } = useGeolocalizacao()

// 3. Estado local (apenas UI)
const showFilters = ref(false)

// 4. Handlers de UI
function handleSearch(): void {
  showFilters.value = false
  search()
}
</script>

<template>
  <!-- Vuetify: use self-closing quando sem conteúdo -->
  <v-text-field v-model="searchQuery" label="Buscar" />
  <!-- Slots: use sintaxe shorthand #slot -->
  <template #item.actions="{ item }">
    <v-btn @click="select(item)" />
  </template>
</template>
```

## Eleições: Lógica de Negócio

```typescript
// Anos e tipos de eleição
// 2018, 2022: Gerais (Presidente, Governador, Senador, Deputados)
// 2020, 2024: Municipais (Prefeito, Vereador)

// Verificar se é eleição municipal (habilita filtro de cidade)
const isEleicaoMunicipal = ano === 2020 || ano === 2024
```

## Segurança

**⛔ NUNCA commitar:**
- Arquivos `.env` (use `NUXT_PUBLIC_*` e `NUXT_*` no Cloudflare)
- Pasta `scripts/` (dados de importação)
- Pasta `dados/` (CSVs do TSE)

## Comandos

```bash
bun run dev          # Desenvolvimento
bun run build        # Build (preset cloudflare-pages)
bun run preview      # Preview local
bun run postinstall  # Preparar Nuxt
```
