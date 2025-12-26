/**
 * API endpoint para detectar geolocalização do usuário via IP
 * Usa a API ip-api.com para obter cidade, estado e país
 */
export default defineEventHandler(async (event) => {
  // Pega o IP do cliente (funciona com proxies)
  const headers = getHeaders(event)
  const ip = headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || getRequestHost(event)
    || ''

  // Se for localhost ou IP inválido, retorna null
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')
  
  if (isLocalhost) {
    // Em desenvolvimento, tenta pegar IP público via API externa
    try {
      const publicIpRes = await fetch('https://api.ipify.org?format=json')
      const publicIpData = await publicIpRes.json()
      const publicIp = publicIpData.ip
      
      if (publicIp) {
        const geoRes = await fetch(`http://ip-api.com/json/${publicIp}`)
        const geoData = await geoRes.json()
        
        if (geoData.status === 'success') {
          return {
            city: geoData.city,
            region: geoData.regionName,
            regionCode: geoData.region, // Sigla do estado (ex: SP, RJ, PE)
            country: geoData.country,
            countryCode: geoData.countryCode,
            ip: publicIp
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar IP público:', e)
    }
    
    return {
      city: null,
      region: null,
      regionCode: null,
      country: null,
      countryCode: null,
      ip
    }
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`)
    const data = await res.json()

    if (data.status === 'success') {
      return {
        city: data.city,
        region: data.regionName,
        regionCode: data.region, // Sigla do estado (ex: SP, RJ, PE)
        country: data.country,
        countryCode: data.countryCode,
        ip
      }
    }

    return {
      city: null,
      region: null,
      regionCode: null,
      country: null,
      countryCode: null,
      ip,
      error: data.message || 'Erro ao obter geolocalização'
    }
  } catch (error) {
    console.error('Erro na API de geolocalização:', error)
    return {
      city: null,
      region: null,
      regionCode: null,
      country: null,
      countryCode: null,
      ip,
      error: 'Erro ao conectar com serviço de geolocalização'
    }
  }
})
