// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  modules: [
    'vuetify-nuxt-module',
  ],

  devtools: { enabled: true },

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
              primary: '#0B2A4A',      // Azul institucional
              secondary: '#FF7A18',    // Laranja NOVO
              accent: '#FFC800',       // Amarelo Sertão

              background: '#FFFFFF',
              surface: '#FFFFFF',

              info: '#1E5A8C',
              success: '#2E7D32',
              warning: '#FFC800',
              error: '#C62828',

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
