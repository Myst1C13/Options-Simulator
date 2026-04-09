import { useState, useRef, useEffect } from 'react'
import { fetchStockPrice } from './api/api'
import { blackScholes, calculateGreeks } from './lib/blackScholes'
import { ExpiryCalendar } from './components/ExpiryCalendar'
import './App.css'

const RISK_FREE_RATE = 0.053

function getNextFriday(): string {
  const today = new Date()
  const day = today.getDay()
  const daysUntil = ((5 - day + 7) % 7) || 7
  const next = new Date(today)
  next.setDate(today.getDate() + daysUntil)
  const y = next.getFullYear()
  const m = String(next.getMonth() + 1).padStart(2, '0')
  const d = String(next.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDaysToExpiry(expiry: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry + 'T00:00:00')
  return Math.max(0, Math.round((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
}

interface Contract {
  strike: number
  expiry: string
  type: 'call' | 'put'
  bid: number
  ask: number
  iv: number
  oi: number
  volume: number
}

// Deterministic pseudo-random from a seed so OI/volume are stable per strike
function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function generateMockChain(stockPrice: number, expiry: string, dte: number): Contract[] {
  const strikes = [-15, -10, -5, -2.5, 0, 2.5, 5, 10, 15, 20].map(
    d => Math.round((stockPrice + d) / 2.5) * 2.5
  )
  const T = Math.max(dte, 1) / 365
  const contracts: Contract[] = []

  strikes.forEach(strike => {
    const distance = (strike - stockPrice) / stockPrice
    // Puts carry a skew premium — IV rises faster on the downside than upside
    const skew = distance < 0 ? -distance * 0.4 : distance * 0.15
    // Quadratic curve so far OTM strikes have meaningfully higher IV
    const curve = distance * distance * 2.5
    const iv = Math.max(0.05, 0.25 + skew + curve)

    const callPrice = blackScholes({ S: stockPrice, K: strike, T, r: RISK_FREE_RATE, sigma: iv, type: 'call' })
    const putPrice = blackScholes({ S: stockPrice, K: strike, T, r: RISK_FREE_RATE, sigma: iv, type: 'put' })

    const callOI = Math.floor(seededRand(strike * 1.1) * 10000)
    const callVol = Math.floor(seededRand(strike * 2.3) * 5000)
    const putOI = Math.floor(seededRand(strike * 3.7) * 10000)
    const putVol = Math.floor(seededRand(strike * 4.9) * 5000)

    contracts.push({
      strike, expiry, type: 'call',
      bid: parseFloat((callPrice * 0.95).toFixed(2)),
      ask: parseFloat((callPrice * 1.05).toFixed(2)),
      iv, oi: callOI, volume: callVol
    })

    contracts.push({
      strike, expiry, type: 'put',
      bid: parseFloat((putPrice * 0.95).toFixed(2)),
      ask: parseFloat((putPrice * 1.05).toFixed(2)),
      iv, oi: putOI, volume: putVol
    })
  })

  return contracts
}

function App() {
  const [ticker, setTicker] = useState('AAPL')
  const [stockPrice, setStockPrice] = useState<number | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selected, setSelected] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(false)
  const [chainType, setChainType] = useState<'call' | 'put'>('call')
  const [expiry, setExpiry] = useState(getNextFriday())
  const [showCalendar, setShowCalendar] = useState(false)
  const [simPrice, setSimPrice] = useState(0)
  const [simDTE, setSimDTE] = useState(() => getDaysToExpiry(getNextFriday()))
  const [simIV, setSimIV] = useState(0)
  const calendarRef = useRef<HTMLDivElement>(null)

  const dte = getDaysToExpiry(expiry)

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleExpiryChange(newExpiry: string) {
    setExpiry(newExpiry)
    const newDte = getDaysToExpiry(newExpiry)
    setSimDTE(newDte)
    setSelected(null)
    if (stockPrice) setContracts(generateMockChain(stockPrice, newExpiry, newDte))
  }

  async function handleFetch() {
    setLoading(true)
    try {
      const price = await fetchStockPrice(ticker)
      setStockPrice(price)
      setContracts(generateMockChain(price, expiry, dte))
      setSimPrice(price)
    } catch(e) {
      alert('Failed to fetch. Check ticker.')
    }
    setLoading(false)
  }

  function selectContract(c: Contract) {
    setSelected(c)
    setSimPrice(stockPrice || c.strike)
    setSimDTE(dte)
    setSimIV(0)
  }

  const filteredContracts = contracts.filter(c => c.type === chainType)

  let pnl = 0
  let greeks = { delta: 0, gamma: 0, theta: 0, vega: 0 }
  let currentPrice = 0

  if (selected && stockPrice) {
    const entry = (selected.bid + selected.ask) / 2
    const sigma = Math.max(0.01, selected.iv + simIV / 100)
    currentPrice = blackScholes({
      S: simPrice,
      K: selected.strike,
      T: simDTE / 365,
      r: RISK_FREE_RATE,
      sigma,
      type: selected.type
    })
    pnl = (currentPrice - entry) * 100
    greeks = calculateGreeks({
      S: simPrice,
      K: selected.strike,
      T: simDTE / 365,
      r: RISK_FREE_RATE,
      sigma,
      type: selected.type
    })
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '2rem',
        fontFamily: 'system-ui'
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: '1.5rem' }}>
        Options Simulator
      </h1>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}
      >
        <input
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          style={{
            fontSize: 18,
            fontWeight: 600,
            padding: '8px 12px',
            width: 120,
            border: '1px solid #ccc',
            borderRadius: 8
          }}
        />
        <button
          onClick={handleFetch}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            background: '#000',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {loading ? 'Loading...' : 'Fetch'}
        </button>
        {/* Expiry picker */}
        <div ref={calendarRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowCalendar(s => !s)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500
            }}
          >
            Exp: {expiry} <span style={{ color: '#888', fontWeight: 400 }}>({dte}d)</span>
          </button>
          {showCalendar && (
            <ExpiryCalendar
              selected={expiry}
              onChange={handleExpiryChange}
              onClose={() => setShowCalendar(false)}
            />
          )}
        </div>
        {stockPrice && (
          <span style={{ fontSize: 22, fontWeight: 500 }}>
            ${stockPrice.toFixed(2)}
          </span>
        )}
      </div>

      {contracts.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12
            }}
          >
            {(['call', 'put'] as const).map(t => (
              <button
                key={t}
                onClick={() => setChainType(t)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 99,
                  border: '1px solid #ccc',
                  cursor: 'pointer',
                  background: chainType === t ? '#000' : '#fff',
                  color: chainType === t ? '#fff' : '#000',
                  fontSize: 13
                }}
              >
                {t === 'call' ? 'Calls' : 'Puts'}
              </button>
            ))}
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              marginBottom: '1.5rem'
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #eee' }}>
                {['Strike', 'Bid', 'Ask', 'IV', 'OI', 'Volume'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      color: '#888',
                      fontWeight: 500,
                      fontSize: 11
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((c, i) => {
                const itm = chainType === 'call'
                  ? c.strike < (stockPrice || 0)
                  : c.strike > (stockPrice || 0)
                const isSelected =
                  selected?.strike === c.strike &&
                  selected?.type === c.type
                return (
                  <tr
                    key={i}
                    onClick={() => selectContract(c)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected
                        ? '#f0f9f0'
                        : itm ? '#f8f8f8' : '#fff',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>
                      ${c.strike}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: itm ? '#16a34a' : '#666' }}>
                      {c.bid.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: itm ? '#16a34a' : '#666' }}>
                      {c.ask.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {(c.iv * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {c.oi.toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {c.volume.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {selected && (
            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                padding: '1.25rem'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {ticker} ${selected.strike} {selected.type === 'call' ? 'Call' : 'Put'} — {selected.expiry}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    Entry: ${((selected.bid + selected.ask) / 2).toFixed(2)} · 1 contract · 100 shares
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: pnl >= 0 ? '#16a34a' : '#dc2626'
                    }}
                  >
                    {pnl >= 0 ? '+' : ''}${Math.round(pnl)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Stock price at expiry</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>${simPrice.toFixed(0)}</span>
                  </div>
                  <input
                    type="range"
                    min={stockPrice! * 0.7}
                    max={stockPrice! * 1.3}
                    step={1}
                    value={simPrice}
                    onChange={e => setSimPrice(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#666' }}>Days until expiry</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{simDTE}d</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={dte}
                    step={1}
                    value={simDTE}
                    onChange={e => setSimDTE(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: '#666' }}>IV change</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{simIV > 0 ? '+' : ''}{simIV}%</span>
                  </div>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    step={1}
                    value={simIV}
                    onChange={e => setSimIV(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 8,
                  paddingTop: '1rem',
                  borderTop: '1px solid #f0f0f0'
                }}
              >
                {[
                  { name: 'Delta', value: greeks.delta.toFixed(3) },
                  { name: 'Gamma', value: greeks.gamma.toFixed(4) },
                  { name: 'Theta', value: greeks.theta.toFixed(3) },
                  { name: 'Vega', value: greeks.vega.toFixed(3) },
                ].map(g => (
                  <div
                    key={g.name}
                    style={{
                      textAlign: 'center',
                      background: '#f8f8f8',
                      borderRadius: 8,
                      padding: '10px 0'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: '#888',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      {g.name}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
                      {g.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App