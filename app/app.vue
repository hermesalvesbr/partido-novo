<script setup lang="ts">
// Google Search Console verification
useHead({
  meta: [
    { name: 'google-site-verification', content: 'WyegARB7I2v1AvlTzR0sheLKNpZ94hhOpFNJO4SWuCo' },
  ],
})

// Canonical e og:url de cada página = o próprio caminho, sem query. Filtros e
// buscas (?uf=PE&ano=2026...) apontam para a página base em vez de virarem
// milhares de URLs duplicadas. Páginas podem sobrescrever (ex.: /analise).
const route = useRoute()
const urlCanonica = computed(() => `https://novo.softagon.app${route.path === '/' ? '/' : route.path.replace(/\/+$/, '')}`)
useHead({
  link: [{ rel: 'canonical', href: urlCanonica }],
})
useSeoMeta({
  ogUrl: urlCanonica,
})
</script>

<template>
  <div>
    <NuxtLoadingIndicator color="#FF9800" :height="4" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
