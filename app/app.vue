<script setup lang="ts">
// Google Search Console verification
useHead({
  meta: [
    { name: 'google-site-verification', content: 'WyegARB7I2v1AvlTzR0sheLKNpZ94hhOpFNJO4SWuCo' },
  ],
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
