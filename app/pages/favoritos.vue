<script setup lang="ts">
// Gerenciamento de favoritos
const { favoritosOrdenados, removeFavorito, totalFavoritos } = useFavoritos()

// SEO Meta
useSeoMeta({
  title: 'Favoritos',
  description: 'Visualize seus candidatos favoritos salvos. Acompanhe o histórico eleitoral e dados de votação dos candidatos que você marcou como favorito.',
  ogTitle: 'Favoritos | NOVO Pernambuco',
  ogDescription: 'Visualize seus candidatos favoritos e acompanhe o histórico eleitoral.',
  twitterTitle: 'Favoritos | NOVO Pernambuco',
  twitterDescription: 'Visualize seus candidatos favoritos e acompanhe o histórico eleitoral.',
})

// Navegação
const router = useRouter()

function goToCandidato(slug: string) {
  router.push(`/candidato/${slug}`)
}
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <!-- Conteúdo -->
    <div class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Estado vazio -->
      <div
        v-if="totalFavoritos === 0"
        class="fill-height d-flex flex-column align-center justify-center pa-6"
      >
        <v-icon size="80" color="grey-lighten-1" class="mb-4">
          mdi-star-outline
        </v-icon>
        <p class="text-h6 text-center text-medium-emphasis mb-2">
          Nenhum favorito ainda
        </p>
        <p class="text-body-2 text-center text-medium-emphasis mb-6">
          Pesquise candidatos e toque na estrela para adicioná-los aos favoritos.
        </p>
        <v-btn color="primary" variant="tonal" to="/">
          <v-icon start>
            mdi-magnify
          </v-icon>
          Buscar candidatos
        </v-btn>
      </div>

      <!-- Lista de favoritos -->
      <div v-else class="pa-4">
        <div class="d-flex align-center justify-space-between mb-3">
          <p class="text-overline text-medium-emphasis mb-0">
            {{ totalFavoritos }} favorito{{ totalFavoritos !== 1 ? 's' : '' }}
          </p>
        </div>

        <v-card rounded="lg" elevation="0">
          <v-list lines="two">
            <v-list-item
              v-for="candidato in favoritosOrdenados"
              :key="candidato.slug"
              class="py-3"
              @click="goToCandidato(candidato.slug)"
            >
              <template #prepend>
                <v-avatar color="primary" variant="tonal">
                  <span class="text-body-2 font-weight-bold">
                    {{ candidato.uf }}
                  </span>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ candidato.nome }}
              </v-list-item-title>

              <v-list-item-subtitle>
                <span v-if="candidato.partido">{{ candidato.partido }}</span>
                <span v-if="candidato.partido && candidato.cargo"> · </span>
                <span v-if="candidato.cargo">{{ candidato.cargo }}</span>
              </v-list-item-subtitle>

              <template #append>
                <v-btn
                  icon="mdi-delete-outline"
                  color="error"
                  variant="text"
                  size="small"
                  @click.stop="removeFavorito(candidato.slug)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </div>
    </div>
  </div>
</template>
