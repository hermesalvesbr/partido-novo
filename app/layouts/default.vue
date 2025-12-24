<template>
  <v-app>
    <!-- Filtros Dinâmicos -->
    <v-navigation-drawer
      v-model="drawer"
      app
      permanent
      color="surface"
      width="300"
    >
      <div class="pa-4">
        <h2 class="text-h6 font-weight-bold mb-4 text-primary">Filtros</h2>
        
        <v-select
          label="Unidade da Federação (UF)"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-4"
        ></v-select>

        <v-select
          label="Ano Eleitoral"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-4"
        ></v-select>

        <v-select
          label="Cargo"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-4"
        ></v-select>
        
        <v-divider class="my-4"></v-divider>
        
        <div class="text-caption text-medium-emphasis mb-2">
          Registros Encontrados
        </div>
        <div class="text-h4 font-weight-bold">
          --
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Barra de Pesquisa Inteligente -->
    <v-app-bar flat border color="surface" height="72">
      <template v-slot:prepend>
        <v-app-bar-nav-icon @click="drawer = !drawer" class="d-lg-none"></v-app-bar-nav-icon>
      </template>

      <v-toolbar-title class="ml-4 font-weight-bold text-h5">
        CIA <span class="text-primary">On-Site</span>
      </v-toolbar-title>

      <v-spacer></v-spacer>

      <div class="d-flex align-center flex-grow-1" style="max-width: 600px;">
        <v-autocomplete
          label="Buscar Cidade ou Partido"
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          density="comfortable"
          hide-details
          rounded="lg"
          class="mr-4"
          placeholder="Digite para buscar..."
        ></v-autocomplete>
      </div>
      
      <v-spacer></v-spacer>

      <v-btn icon>
        <v-icon>mdi-bell-outline</v-icon>
      </v-btn>
      <v-avatar color="primary" class="ml-2" size="40">
        <span class="text-white">AD</span>
      </v-avatar>
    </v-app-bar>

    <v-main class="bg-grey-lighten-4">
      <v-container fluid class="pa-6">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const drawer = ref(true)
</script>

<style scoped>
/* Custom Scrollbar for Drawer if needed */
.v-navigation-drawer__content::-webkit-scrollbar {
  width: 4px;
}
</style>
