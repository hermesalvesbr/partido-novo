<script setup lang="ts">
const route = useRoute()

// Estado do drawer para menu lateral (opcional em mobile)
const drawer = ref(false)

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
      <!-- Logo à esquerda -->
      <template #prepend>
        <v-avatar
          size="36"
          rounded="lg"
          class="ml-1"
          color="white"
        >
          <v-img
            src="/android/android-launchericon-96-96.png"
            alt="Logo"
            cover
          />
        </v-avatar>
      </template>

      <!-- Título centralizado -->
      <v-app-bar-title class="text-body-1 font-weight-bold">
        NOVO Pernambuco
      </v-app-bar-title>
    </v-app-bar>

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
