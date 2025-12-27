<script setup lang="ts">
// Adiciona fonte Manrope via Google Fonts
useHead({
  link: [
    {
      rel: 'preconnect',
      href: 'https://fonts.googleapis.com',
    },
    {
      rel: 'preconnect',
      href: 'https://fonts.gstatic.com',
      crossorigin: '',
    },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@800&display=swap',
    },
  ],
})

const route = useRoute()

// Sistema de favoritos
const { totalFavoritos } = useFavoritos()

// Navegação bottom para mobile
const navItems = computed(() => [
  { title: 'Buscar', icon: 'mdi-magnify', to: '/' },
  { title: 'Regiões', icon: 'mdi-map-marker-radius', to: '/regioes' },
  {
    title: 'Favoritos',
    icon: totalFavoritos.value > 0 ? 'mdi-star' : 'mdi-star-outline',
    to: '/favoritos',
    badge: totalFavoritos.value > 0 ? totalFavoritos.value : null,
  },
  { title: 'Sobre', icon: 'mdi-information-outline', to: '/sobre' },
])

// Item ativo baseado na rota atual
const activeNav = computed(() => {
  const path = route.path
  const index = navItems.value.findIndex(item => item.to === path)
  return index >= 0 ? index : 0
})
</script>

<template>
  <v-app>
    <!-- App Bar compacto e moderno -->
    <v-app-bar
      color="primary"
      density="compact"
      elevation="0"
      flat
    >
      <!-- Espaço para a logo floating -->
      <template #prepend>
        <div class="ml-1" style="width: 52px;" />
      </template>

      <!-- Título centralizado com fonte Manrope -->
      <v-app-bar-title>
        <span class="novo-title">NOVO</span>
        <span class="text-white font-weight-bold ml-1">Pernambuco</span>
      </v-app-bar-title>
    </v-app-bar>

    <!-- Logo floating sobre a app bar -->
    <v-avatar
      size="56"
      class="position-fixed elevation-4"
      style="top: 4px; left: 12px; z-index: 1100;"
      image="/android/android-launchericon-96-96.png"
    />

    <!-- Conteúdo principal com scroll -->
    <v-main class="bg-grey-lighten-4">
      <slot />
    </v-main>

    <!-- Bottom Navigation para mobile -->
    <v-bottom-navigation
      :model-value="activeNav"
      color="primary"
      grow
      density="comfortable"
      elevation="8"
      bg-color="surface"
    >
      <v-btn
        v-for="(item, index) in navItems"
        :key="index"
        :to="item.to"
        :value="index"
        min-width="60"
      >
        <template v-if="item.badge">
          <v-chip size="x-small" color="warning" variant="flat" class="font-weight-bold">
            {{ item.badge }}
          </v-chip>
        </template>
        <v-icon v-else size="22">
          {{ item.icon }}
        </v-icon>
        <span class="text-caption mt-1">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<style scoped>
.novo-title {
  font-family: 'Manrope', sans-serif !important;
  font-weight: 800 !important;
  color: #ff7a18 !important; /* Laranja NOVO - secondary */
}
</style>
