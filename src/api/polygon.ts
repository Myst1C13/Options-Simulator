const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_KEY

export async function fetchStockPrice(ticker: string): Promise<number> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  return parseFloat(data['Global Quote']['05. price'])
}

export async function fetchOptionsChain(ticker: string): Promise<any[]> {
  const url = `https://www.alphavantage.co/query?function=HISTORICAL_OPTIONS&symbol=${ticker}&apikey=${API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  return data.data || []
}