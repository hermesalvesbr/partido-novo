import type { CandidatoLocaisResponse } from '~/data/eleicoes'
import { porArea, porBairro, porRegiao, porZona } from '~/utils/locais'

/**
 * Votos do candidato por escola (local de votação) numa eleição, com o filtro
 * de município guardado na URL (?municipio=ARARIPINA) e os agregados já filtrados.
 */
export function useCandidatoLocais(slug: Ref<string>, ano: Ref<number | null>, opcoes: { server?: boolean } = {}) {
  const route = useRoute()
  const router = useRouter()

  const asyncData = useAsyncData<CandidatoLocaisResponse>(
    () => `locais-${slug.value}-${ano.value ?? 'ultimo'}`,
    () => $fetch<CandidatoLocaisResponse>('/api/candidato-locais', {
      query: { slug: slug.value, ano: ano.value ?? undefined },
    }),
    {
      getCachedData(key, nuxtApp, ctx) {
        if (ctx.cause === 'refresh:manual')
          return undefined
        return nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
      },
      lazy: import.meta.client,
      // o card-resumo do perfil passa false para não atrasar o SSR da página
      server: opcoes.server ?? true,
    },
  )
  const { data, status, error } = asyncData

  const municipio = computed<string | null>({
    get: () => {
      const valor = route.query.municipio
      return typeof valor === 'string' && data.value?.municipios.some(m => m.nome === valor) ? valor : null
    },
    set: (valor) => {
      const { municipio: _m, ...resto } = route.query
      router.replace({ query: valor ? { ...resto, municipio: valor } : resto })
    },
  })

  const locais = computed(() => {
    const todos = data.value?.locais ?? []
    return municipio.value ? todos.filter(l => l.municipio === municipio.value) : todos
  })
  const municipioSelecionado = computed(() => data.value?.municipios.find(m => m.nome === municipio.value) ?? null)
  const totalVotos = computed(() => locais.value.reduce((a, l) => a + l.votos, 0))

  const bairros = computed(() => porBairro(locais.value))
  const areas = computed(() => porArea(locais.value))
  const zonas = computed(() => porZona(locais.value))
  const microrregioes = computed(() => porRegiao(locais.value, data.value?.municipios ?? [], 'microrregiao'))
  const mesorregioes = computed(() => porRegiao(locais.value, data.value?.municipios ?? [], 'mesorregiao'))

  return {
    /** a página espera isto no SSR para responder 404 de verdade */
    pronto: Promise.resolve(asyncData).then(() => undefined),
    data,
    status,
    error,
    municipio,
    municipioSelecionado,
    locais,
    totalVotos,
    bairros,
    areas,
    zonas,
    microrregioes,
    mesorregioes,
  }
}
