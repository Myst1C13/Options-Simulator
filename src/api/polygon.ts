const API_KEY = import.meta.env.VITE_POLYGON_API_KEY

interface OptionContract {
  strike_price: number
  expiration_date: string
  contract_type: 'call' | 'put'
  ticker: string
  day: {
    close: number
    volume: number
  }
  greeks: {
    delta: number
    gamma: number
    theta: number
    vega: number
  }
  last_quote: {
    ask: number
    bid: number
  }
  open_interest: number
  implied_volatility: number
}

interface PolygonOptionsResponse {
  results: OptionContract[]
  status: string
}

export async function fetchOptionsChain(ticker: string): Promise<OptionContract[]> {
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?limit=250&apiKey=${API_KEY}`
  const response = await fetch(url)
  const data: PolygonOptionsResponse = await response.json()
  return data.results
}

export async function fetchStockPrice(ticker: string): Promise<number> {
  const url = `https://api.polygon.io/v2/last/trade/${ticker}?apiKey=${API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  return data.results.p
}