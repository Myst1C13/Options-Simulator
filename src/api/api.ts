const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY

export async function fetchStockPrice(ticker: string): Promise<number> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  return parseFloat(data['Global Quote']['05. price'])
}

export async function fetchOptionsChain(
  ticker: string,
  expiration?: string,
): Promise<unknown[]> {
  const url = new URL('https://www.alphavantage.co/query')
  url.searchParams.set('function', 'REALTIME_OPTIONS')
  url.searchParams.set('symbol', ticker)
  url.searchParams.set('require_greeks', 'true')
  url.searchParams.set('apikey', API_KEY ?? '')
  if (expiration) {
    url.searchParams.set('expiration', expiration)
  }

  const response = await fetch(url.toString())
  const data = await response.json()

  if (!response.ok) {
    throw new Error('Options chain request failed')
  }

  if (
    data &&
    typeof data === 'object' &&
    ('Information' in data || 'Note' in data || 'Error Message' in data)
  ) {
    throw new Error('Options chain unavailable')
  }

  return Array.isArray(data.data) ? data.data : []
}
