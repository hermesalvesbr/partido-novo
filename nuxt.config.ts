// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  modules: [
    'vuetify-nuxt-module',
    '@nuxt/image',
  ],

  devtools: { enabled: false },

  // Experimental features para melhor performance
  experimental: {
    // Habilita controle granular do cache para getCachedData
    granularCachedData: true,
  },

  // Configuração do @nuxt/image para otimização e cache
  image: {
    // Qualidade padrão das imagens
    quality: 85,
    // Presets reutilizáveis para logos de partidos (mantém PNG para transparência)
    presets: {
      partido: {
        modifiers: {
          width: 48,
          height: 48,
          fit: 'inside',
          quality: 85,
        },
      },
      partidoSmall: {
        modifiers: {
          width: 40,
          height: 40,
          fit: 'inside',
          quality: 85,
        },
      },
    },
    // Cache de 1 ano para imagens otimizadas
    ipx: {
      maxAge: 60 * 60 * 24 * 365,
    },
  },

  // SEO Global Configuration
  app: {
    head: {
      title: 'NOVO Pernambuco',
      titleTemplate: '%s | NOVO Pernambuco',
      htmlAttrs: {
        lang: 'pt-BR',
      },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      meta: [
        { name: 'description', content: 'Consulte dados eleitorais do TSE, candidatos, resultados de eleições e histórico político. Pesquise por nome, cidade ou região.' },
        { name: 'author', content: 'Softagon Sistemas' },
        { name: 'keywords', content: 'eleições, candidatos, TSE, resultados eleitorais, votos, Pernambuco, Brasil, política, vereador, prefeito, deputado, governador' },
        // Open Graph
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'pt_BR' },
        { property: 'og:site_name', content: 'NOVO Pernambuco' },
        { property: 'og:title', content: 'NOVO Pernambuco - Dados Eleitorais do TSE' },
        { property: 'og:description', content: 'Consulte dados eleitorais do TSE, candidatos, resultados de eleições e histórico político.' },
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'NOVO Pernambuco - Dados Eleitorais do TSE' },
        { name: 'twitter:description', content: 'Consulte dados eleitorais do TSE, candidatos, resultados de eleições e histórico político.' },
        // Theme Color
        { name: 'theme-color', content: '#0B2A4A' },
        // Mobile Web App
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'NOVO PE' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/android/android-launchericon-192-192.png' },
        { rel: 'canonical', href: 'https://novo.softagon.app' },
      ],
    },
  },

  // Cloudflare Pages deployment
  nitro: {
    preset: 'cloudflare-pages',
  },

  runtimeConfig: {
    // Server-only (private) - Set via environment variables
    // NUXT_DATABASE_URL, NUXT_PG_HOST, NUXT_PG_PORT, NUXT_PG_USER, NUXT_PG_PASSWORD, NUXT_PG_DATABASE
    databaseUrl: '',
    pgHost: '',
    pgPort: '',
    pgUser: '',
    pgPassword: '',
    pgDatabase: '',
    // Public (exposed to client)
    public: {
      postgrestUrl: 'https://apinovo.softagon.app',
    },
  },

  vuetify: {
    moduleOptions: {
      styles: true,
    },
    vuetifyOptions: {
      theme: {
        defaultTheme: 'light',
        themes: {
          light: {
            colors: {
              'primary': '#0B2A4A', // Azul institucional
              'secondary': '#FF7A18', // Laranja NOVO
              'accent': '#FFC800', // Amarelo Sertão

              'background': '#FFFFFF',
              'surface': '#FFFFFF',

              'info': '#1E5A8C',
              'success': '#2E7D32',
              'warning': '#FFC800',
              'error': '#C62828',

              'on-primary': '#FFFFFF',
              'on-secondary': '#FFFFFF',
              'on-accent': '#0B2A4A',
            },
          },
        },
      },
    },
  },
})
