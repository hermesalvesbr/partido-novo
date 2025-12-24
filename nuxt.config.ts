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
              primary: '#1976D2',
              secondary: '#7B1FA2',
              accent: '#FF6F00',
              success: '#4CAF50',
              info: '#2196F3',
              warning: '#FB8C00',
              error: '#FF5252',
            },
          },
        },
      },
    },
  },
})
