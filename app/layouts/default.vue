<script setup lang="ts">
const route = useRoute()

// Navegação bottom para mobile
const navItems = [
  { title: 'Buscar', icon: 'mdi-magnify', to: '/' },
  { title: 'Estatísticas', icon: 'mdi-chart-bar', to: '/stats' },
  { title: 'Favoritos', icon: 'mdi-star-outline', to: '/favoritos' },
  { title: 'Sobre', icon: 'mdi-information-outline', to: '/sobre' },
]

// Item ativo baseado na rota atual
const activeNav = computed(() => {
  const path = route.path
  const index = navItems.findIndex(item => item.to === path)
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

      <!-- Título centralizado -->
      <v-app-bar-title class="text-body-1 font-weight-bold">
        NOVO Pernambuco
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
        <v-icon size="22">
          {{ item.icon }}
        </v-icon>
        <span class="text-caption mt-1">{{ item.title }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
