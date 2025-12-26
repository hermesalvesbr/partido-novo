<script setup lang="ts">
useHead({
  title: 'Sobre',
})

// Links de contato
const contatos = [
  {
    icon: 'mdi-whatsapp',
    label: 'WhatsApp',
    value: '(87) 99118-9300',
    href: 'https://wa.me/5587991189300?text=Olá! Vim pelo app NOVO Pernambuco.',
    color: 'success',
  },
  {
    icon: 'mdi-web',
    label: 'Site',
    value: 'softagon.com.br',
    href: 'https://softagon.com.br',
    color: 'primary',
  },
  {
    icon: 'mdi-instagram',
    label: 'Instagram',
    value: '@softagonsistemas',
    href: 'https://instagram.com/softagonsistemas',
    color: 'pink',
  },
  {
    icon: 'mdi-linkedin',
    label: 'LinkedIn',
    value: 'Softagon Sistemas',
    href: 'https://linkedin.com/company/softagonsistemas',
    color: 'info',
  },
]

const redesSociais = [
  { icon: 'mdi-facebook', href: 'https://facebook.com/SOFTAGON', color: 'indigo' },
  { icon: 'mdi-youtube', href: 'https://youtube.com/@softagonsistemas', color: 'error' },
  { icon: 'mdi-twitter', href: 'https://x.com/SoftagonBR', color: 'grey' },
]
</script>

<template>
  <div class="d-flex flex-column fill-height">
    <div class="flex-grow-1 overflow-y-auto bg-grey-lighten-4">
      <!-- Header com logo -->
      <v-card flat class="rounded-0 text-center pa-6">
        <v-img
          src="/softagon-sistemas.png"
          alt="Softagon Sistemas"
          max-width="200"
          class="mx-auto mb-4"
        />
        <p class="text-body-2 text-medium-emphasis">
          Desenvolvido por
        </p>
        <h1 class="text-h5 font-weight-bold text-primary mb-2">
          Softagon Sistemas
        </h1>
        <v-chip color="secondary" variant="tonal" size="small">
          <v-icon start size="small">
            mdi-clock-outline
          </v-icon>
          23+ anos de experiência
        </v-chip>
      </v-card>

      <!-- Sobre a empresa -->
      <div class="px-4 py-4">
        <p class="text-overline text-medium-emphasis mb-2">
          Sobre a Empresa
        </p>
        <v-card rounded="lg" elevation="0">
          <v-card-text>
            <p class="text-body-1 mb-3">
              A <strong>Softagon</strong> é uma empresa especializada em
              <strong>GovTech</strong>, desenvolvendo soluções tecnológicas
              inovadoras para gestão pública municipal.
            </p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              Com mais de duas décadas de experiência, oferecemos sistemas que
              transformam prefeituras em máquinas eficientes, eliminando burocracia
              e aproximando o cidadão dos serviços públicos.
            </p>
          </v-card-text>
        </v-card>
      </div>

      <!-- Produtos -->
      <div class="px-4 pb-4">
        <p class="text-overline text-medium-emphasis mb-2">
          Nossos Produtos
        </p>
        <v-row dense>
          <v-col cols="12">
            <v-card rounded="lg" elevation="0" color="primary" variant="tonal">
              <v-card-text class="d-flex align-center">
                <v-icon size="40" color="primary" class="mr-3">
                  mdi-city
                </v-icon>
                <div>
                  <p class="text-body-1 font-weight-bold mb-0">
                    CIA
                  </p>
                  <p class="text-caption text-medium-emphasis mb-0">
                    Cidade com Inteligência Artificial
                  </p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12">
            <v-card rounded="lg" elevation="0" color="secondary" variant="tonal">
              <v-card-text class="d-flex align-center">
                <v-icon size="40" color="secondary" class="mr-3">
                  mdi-school
                </v-icon>
                <div>
                  <p class="text-body-1 font-weight-bold mb-0">
                    EduPrime
                  </p>
                  <p class="text-caption text-medium-emphasis mb-0">
                    Diário Digital Inteligente
                  </p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- Contatos -->
      <div class="px-4 pb-4">
        <p class="text-overline text-medium-emphasis mb-2">
          Contato
        </p>
        <v-card rounded="lg" elevation="0">
          <v-list>
            <v-list-item
              v-for="contato in contatos"
              :key="contato.label"
              :href="contato.href"
              target="_blank"
              class="py-2"
            >
              <template #prepend>
                <v-avatar :color="contato.color" variant="tonal" size="40">
                  <v-icon :color="contato.color">
                    {{ contato.icon }}
                  </v-icon>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ contato.label }}
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ contato.value }}
              </v-list-item-subtitle>

              <template #append>
                <v-icon size="small" color="grey">
                  mdi-open-in-new
                </v-icon>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </div>

      <!-- Redes Sociais -->
      <div class="px-4 pb-4">
        <p class="text-overline text-medium-emphasis mb-2">
          Redes Sociais
        </p>
        <div class="d-flex justify-center ga-3">
          <v-btn
            v-for="rede in redesSociais"
            :key="rede.icon"
            :href="rede.href"
            target="_blank"
            :color="rede.color"
            variant="tonal"
            icon
            size="large"
          >
            <v-icon>{{ rede.icon }}</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Sobre o App -->
      <div class="px-4 pb-6">
        <p class="text-overline text-medium-emphasis mb-2">
          Sobre o App
        </p>
        <v-card rounded="lg" elevation="0">
          <v-card-text class="text-center">
            <v-avatar size="64" class="mb-3">
              <v-img src="/android/android-launchericon-96-96.png" />
            </v-avatar>
            <p class="text-body-1 font-weight-bold mb-1">
              NOVO Pernambuco
            </p>
            <p class="text-caption text-medium-emphasis mb-3">
              Consulta de dados eleitorais do TSE
            </p>
            <v-chip size="small" variant="outlined">
              Versão 1.0.0
            </v-chip>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>
