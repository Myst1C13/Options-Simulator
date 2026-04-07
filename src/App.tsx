import { useState } from 'react'
import { fetchOptionsChain, fetchStockPrice } from './api/api'

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [price, setPrice] = useState<number | null>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFetch() {
    setLoading(true)
    setError(null)
    try {
      const stockPrice = await fetchStockPrice(ticker)
      const chain = await fetchOptionsChain(ticker)
      setPrice(stockPrice)
      setContracts(chain)
    } catch (e) {
      setError('Failed to fetch data. Check your API key.')
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Options Simulator</h1>
      <div>
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          placeholder="Enter ticker"
        />
        <button onClick={handleFetch}>Fetch</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {price && <p>Stock price: ${price.toFixed(2)}</p>}
      {contracts.length > 0 && (
        <p>Loaded {contracts.length} contracts</p>
      )}
    </div>
  )
}

export default App