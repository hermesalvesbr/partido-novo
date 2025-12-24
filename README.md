CIA On-Site: Plataforma de Inteligência e Análise Política

Este projeto visa transformar dados brutos do Tribunal Superior Eleitoral (TSE) em insights estratégicos, utilizando uma arquitetura de alta performance baseada em PostgreSQL 18  , com interface em Nuxt 4 e Vuetify.
🎨 Interface de Análise (Vuetify +  )

A interface foi projetada para ser um "Cockpit de Decisão", onde a velocidade de filtragem é o requisito primordial.
1. Discovery e Busca Facetada

    Barra de Pesquisa Inteligente: Utiliza o componente v-autocomplete do Vuetify integrado ao  . Ao digitar o nome de uma cidade ou partido, o sistema realiza uma busca por facetas, retornando resultados em menos de 50ms.

    Filtros Dinâmicos: Painéis laterais (v-navigation-drawer) permitem o refinamento por Unidade da Federação (UF), Cargo e Ano Eleitoral. As contagens de registros (ex: "X candidatos encontrados") são atualizadas instantaneamente via   antes mesmo da consulta ao banco de dados.

2. Dashboard de Resultados

    Cartões de Métricas: Uso de v-card para exibir KPIs como Votos Totais, Quociente Eleitoral e Percentual de Votação Nominal.

    Visualização de Dados: Integração de componentes de gráficos (Sparklines e Bar Charts) para comparar o desempenho entre eleições.

    Tabelas de Dados: v-data-table-server para listar resultados de seções eleitorais de forma paginada, garantindo que o frontend não sobrecarregue com os milhões de registros do TSE.

## 🗄️ Pipeline de Dados (PostgreSQL 18 + Bun)

### Arquitetura de Ingestão

O projeto utiliza um pipeline de dados de alta performance baseado em **Bun SQL nativo** para processar e armazenar os dados brutos do TSE.

#### Características Técnicas:

1. **Bun SQL Nativo**: Utilização da API SQL nativa do Bun (`import { SQL } from 'bun'`) com bindings nativos para PostgreSQL, oferecendo performance superior a bibliotecas JavaScript tradicionais.

2. **Connection Pooling**: Pool de conexões otimizado com até 20 conexões concorrentes:
   ```typescript
   const sql = new SQL({
     max: 20,              // Máximo de 20 conexões
     idleTimeout: 30,      // Fechar conexões idle após 30s
     maxLifetime: 3600,    // Vida máxima da conexão: 1h
     connectionTimeout: 10 // Timeout de conexão: 10s
   })
   ```

3. **Tabela Única Multi-Ano**: Uma única tabela `votacao_candidato_munzona` consolida dados de todas as eleições (2018, 2020, 2022, 2024), com constraint `UNIQUE` para evitar duplicatas:
   ```sql
   CONSTRAINT uk_votacao UNIQUE (
     ano_eleicao, nr_turno, sg_uf, cd_municipio,
     nr_zona, sq_candidato, cd_cargo
   )
   ```

4. **Inserção Otimizada**: 
   - Batch inserts de 5.000 registros por vez
   - `ON CONFLICT DO NOTHING` para skip silencioso de duplicatas
   - Streaming de arquivos CSV (até 4GB) sem carregar na memória
   - Decodificação Windows-1252 para caracteres latinos

5. **Indexação Estratégica**: Índices criados em paralelo para queries rápidas:
   - `idx_ano_eleicao`: Filtros por ano
   - `idx_sg_uf`: Filtros por UF
   - `idx_cd_municipio`: Filtros por município
   - `idx_sq_candidato`: Lookup de candidatos
   - `idx_ano_uf_municipio`: Queries compostas

### Como Executar a Importação

```bash
# 1. Configure as credenciais do PostgreSQL
cp .env.example .env
# Edite o .env com suas credenciais

# 2. Execute o script de importação
cd scripts
bun run import_votes.ts

# Ou com preconnect para melhor performance
bun --sql-preconnect import_votes.ts
```

### Performance Esperada

- **Throughput**: ~50.000-100.000 registros/segundo (dependendo da máquina)
- **Arquivo 4GB**: ~5-10 minutos de processamento
- **Memória**: Consumo constante (~200MB) graças ao streaming

### Estrutura de Dados

Os dados são armazenados no formato original do TSE, com 50 colunas incluindo:
- Identificação da eleição (ano, turno, cargo)
- Localização (UF, município, zona)
- Dados do candidato (nome, partido, federação)
- Resultados de votação (votos nominais, votos válidos)