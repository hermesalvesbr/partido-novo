# Instruções do GitHub Copilot para o Projeto Partido Novo

## Visão Geral do Projeto

Este é um projeto de análise de dados políticos brasileiros, focado em visualização de dados eleitorais. O projeto utiliza **Nuxt 4** com **Vuetify 3** e acessa dados via **PostgREST API**.

## Stack Tecnológica

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| Nuxt | ^4.2.2 | Framework full-stack Vue com SSR |
| Vue | ^3.5.26 | Framework reativo principal |
| Vuetify | vuetify-nuxt-module ^0.19.1 | Componentes Material Design |
| PostgREST | @supabase/postgrest-js ^2.89.0 | Cliente REST para PostgreSQL |
| ESLint | @antfu/eslint-config ^6.7.1 | Linting e formatação |

## ⚠️ Regras Obrigatórias

### 1. Gerenciador de Pacotes: Sempre use BUN

```bash
# ✅ CORRETO - Sempre use bun
bun install
bun add <pacote>
bun add -D <pacote>
bun run dev
bun run build

# ❌ INCORRETO - Nunca use npm, yarn ou pnpm
npm install    # NÃO USE
yarn add       # NÃO USE
pnpm install   # NÃO USE
```

### 2. Versões: Sempre use a última versão

Ao adicionar dependências, sempre use a versão mais recente disponível:

```bash
# ✅ CORRETO
bun add <pacote>@latest

# Para verificar atualizações
bun outdated
```

### 3. Lock Files: Não commitar arquivos de lock

O `.gitignore` já está configurado para ignorar:
- `bun.lock` / `bun.lockb`
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`
- Qualquer arquivo `*.lock`

### 4. TypeScript: Zero erros tolerados

- Todos os arquivos devem passar na verificação de tipos
- Use interfaces/types para definir estruturas de dados
- Evite `any` - prefira tipos específicos ou `unknown`

## Estrutura do Projeto

```
app/
├── app.vue              # Componente raiz
├── composables/         # Composables reutilizáveis
│   └── usePostgrest.ts  # Cliente PostgREST
├── layouts/
│   └── default.vue      # Layout padrão com Vuetify
└── pages/
    └── index.vue        # Dashboard de análise política
```

## Padrões de Código

### Componentes Vue (Composition API + Script Setup)

```vue
<script setup lang="ts">
// Imports primeiro
import { ref, computed, onMounted } from 'vue'
import type { MeuTipo } from '~/types'

// Composables
const { data, loading } = useAlgumaCoisa()

// Estado reativo
const items = ref<MeuTipo[]>([])

// Computeds
const filteredItems = computed(() => items.value.filter(/* ... */))

// Lifecycle
onMounted(async () => {
  // ...
})
</script>

<template>
  <!-- Vuetify components com self-closing quando sem conteúdo -->
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>Título</v-card-title>
          <v-card-text>Conteúdo</v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
```

### Slots Vuetify (Sintaxe Shorthand)

```vue
<!-- ✅ CORRETO - Use sintaxe shorthand -->
<v-data-table :items="items">
  <template #item.nome="{ item }">
    {{ item.nome }}
  </template>
  <template #item.acoes="{ item }">
    <v-btn @click="editar(item)" />
  </template>
</v-data-table>

<!-- ❌ INCORRETO - Não use v-slot: completo -->
<template v-slot:item.nome="{ item }">  <!-- NÃO USE -->
```

### PostgREST Queries

```typescript
// Use o composable usePostgrest
const { client, searchCandidatos, getTopCandidatos } = usePostgrest()

// Query direta quando necessário
const { data, error } = await client
  .from('tabela')
  .select('*')
  .eq('coluna', valor)
  .order('coluna', { ascending: false })
  .limit(10)
```

## API e Dados

### Endpoint PostgREST
- **URL Base**: `https://apinovo.softagon.app`
- Configurado via `NUXT_PUBLIC_POSTGREST_URL` no `.env`

### Tabela Principal: `votacao_candidato_munzona`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ano_eleicao | integer | Ano da eleição (2018, 2020, 2022, 2024) |
| nm_candidato | text | Nome do candidato |
| sg_partido | text | Sigla do partido |
| sg_uf | text | Unidade federativa |
| ds_cargo | text | Descrição do cargo |
| nm_municipio | text | Nome do município |
| nr_turno | integer | Número do turno |
| qt_votos_nominais | integer | Quantidade de votos |

## Convenções de Nomenclatura

- **Arquivos**: kebab-case (`meu-componente.vue`)
- **Componentes**: PascalCase (`MeuComponente`)
- **Composables**: camelCase com prefixo `use` (`usePostgrest`)
- **Variáveis**: camelCase (`minhaVariavel`)
- **Interfaces/Types**: PascalCase (`interface MeuTipo`)
- **Constantes**: SCREAMING_SNAKE_CASE (`const MAX_ITEMS = 100`)

## Vuetify: Boas Práticas

### Componentes Self-Closing
```vue
<!-- ✅ Self-closing quando não há conteúdo -->
<v-text-field v-model="search" label="Buscar" />
<v-btn icon @click="submit" />
<v-divider />

<!-- ✅ Com conteúdo, use tags de fechamento -->
<v-btn>Clique aqui</v-btn>
<v-card>
  <v-card-text>Conteúdo</v-card-text>
</v-card>
```

### Responsividade
```vue
<v-col cols="12" sm="6" md="4" lg="3">
  <!-- Adapta automaticamente -->
</v-col>
```

## Segurança

### ⛔ Nunca commitar:
- Credenciais de banco de dados
- Tokens de API
- Arquivos `.env` (exceto `.env.example`)
- Pasta `scripts/` (contém dados sensíveis)
- Pasta `dados/` (CSVs de votação)
- Pasta `server/api/` (pode conter lógica de banco)

### ✅ Configuração segura:
```typescript
// nuxt.config.ts - use runtimeConfig
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      postgrestUrl: '' // Definido via NUXT_PUBLIC_POSTGREST_URL
    }
  }
})
```

## Deploy

- **Plataforma**: Cloudflare Pages
- **Preset Nitro**: `cloudflare-pages`

```bash
# Build para produção
bun run build

# Preview local
bun run preview
```

## Comandos Úteis

```bash
# Desenvolvimento
bun run dev

# Build
bun run build

# Lint
bun run lint

# Verificar tipos
bun run typecheck

# Preparar Nuxt
bun run postinstall
```

## Referências de Documentação

- [Nuxt 4 Docs](https://nuxt.com/docs/4.x)
- [Vuetify 3 Docs](https://vuetifyjs.com/)
- [PostgREST JS](https://github.com/supabase/postgrest-js)
- [@antfu/eslint-config](https://github.com/antfu/eslint-config)
