import { useState } from 'react'
import { fetchStockPrice } from './api/api'
import { blackScholes, calculateGreeks } from './lib/blackScholes'
import './App.css'

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

function generateMockChain(stockPrice: number): Contract[] {
  const strikes = [-15, -10, -5, -2.5, 0, 2.5, 5, 10, 15, 20].map(
    d => Math.round((stockPrice + d) / 2.5) * 2.5
  )
  const expiry = '2026-05-16'
  const contracts: Contract[] = []
  strikes.forEach(strike => {
    const iv = 0.25 + Math.abs(strike - stockPrice) * 0.001
    const callPrice = blackScholes({ S: stockPrice, K: strike, T: 17/365, r: 0.053, sigma: iv, type: 'call' })
    const putPrice = blackScholes({ S: stockPrice, K: strike, T: 17/365, r: 0.053, sigma: iv, type: 'put' })
    contracts.push({ 
      strike, 
      expiry, 
      type: 'call', 
      bid: parseFloat((callPrice * 0.95).toFixed(2)), 
      ask: parseFloat((callPrice * 1.05).toFixed(2)), 
      iv, 
      oi: Math.floor(Math.random() * 10000), 
      volume: Math.floor(Math.random() * 5000) 
    })
    contracts.push({ 
      strike, 
      expiry, 
      type: 'put', 
      bid: parseFloat((putPrice * 0.95).toFixed(2)), 
      ask: parseFloat((putPrice * 1.05).toFixed(2)), 
      iv, 
      oi: Math.floor(Math.random() * 10000), 
      volume: Math.floor(Math.random() * 5000) 
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
  const [simPrice, setSimPrice] = useState(0)
  const [simDTE, setSimDTE] = useState(17)
  const [simIV, setSimIV] = useState(0)
  const [activeScenario, setActiveScenario] = useState<string>('custom')

  async function handleFetch() {
    setLoading(true)
    try {
      const price = await fetchStockPrice(ticker)
      setStockPrice(price)
      setContracts(generateMockChain(price))
      setSimPrice(price)
    } catch(e) {
      alert('Failed to fetch. Check ticker.')
    }
    setLoading(false)
  }

  function selectContract(c: Contract) {
    setSelected(c)
    setSimPrice(stockPrice || c.strike)
    setSimDTE(17)
    setSimIV(0)
    setActiveScenario('custom')
  }

  const filteredContracts = contracts.filter(c => c.type === chainType)

  let pnl = 0
  let greeks = { delta: 0, gamma: 0, theta: 0, vega: 0 }

  if (selected && stockPrice) {
    const entry = (selected.bid + selected.ask) / 2
    const sigma = Math.max(0.01, selected.iv + simIV / 100)
    const currentPrice = blackScholes({
      S: simPrice, K: selected.strike,
      T: simDTE / 365, r: 0.053,
      sigma, type: selected.type
    })
    pnl = (currentPrice - entry) * 100
    greeks = calculateGreeks({
      S: simPrice, K: selected.strike,
      T: simDTE / 365, r: 0.053,
      sigma, type: selected.type
    })
  }

  const entry = selected ? (selected.bid + selected.ask) / 2 : 0
  const breakeven = selected ? (selected.type === 'call' ? selected.strike + entry : selected.strike - entry) : 0
  const pct = entry > 0 ? (pnl / (entry * 100)) * 100 : 0

  function applyScenario(scenario: string) {
    if (!selected || !stockPrice) return
    setActiveScenario(scenario)
    if (scenario === 'hits') setSimPrice(selected.strike)
    if (scenario === 'expiry') setSimDTE(0)
    if (scenario === 'crush') setSimIV(-30)
    if (scenario === 'spike') setSimIV(20)
    if (scenario === 'custom') {
        setSimPrice(stockPrice)
        setSimDTE(17)
        setSimIV(0)
    }
  }

  return (
    <div>
      {/* SECTION 1 — Top bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '0.05em', margin: 0 }}>OPTIONS_SIM</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="TICKER"
              style={{ width: '80px', height: '36px', boxSizing: 'border-box' }}
            />
            <button onClick={handleFetch} className="fetch-btn" style={{ height: '36px' }}>
              {loading ? '...' : 'FETCH'}
            </button>
          </div>
        </div>
        {stockPrice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px', fontWeight: 600 }}>${stockPrice.toFixed(2)}</span>
            <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: 600, background: '#f0faf0', padding: '2px 6px', borderRadius: '4px' }}>+1.24%</span>
          </div>
        )}
      </header>

      {/* SECTION 2 — Options chain */}
      {contracts.length > 0 && (
        <section>
          <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
            <button 
              className={`tab-btn ${chainType === 'call' ? 'active' : ''}`} 
              onClick={() => setChainType('call')}
            >
              Calls
            </button>
            <button 
              className={`tab-btn ${chainType === 'put' ? 'active' : ''}`} 
              onClick={() => setChainType('put')}
            >
              Puts
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Strike</th>
                <th>Bid</th>
                <th>Ask</th>
                <th>IV</th>
                <th>OI</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {filteredContracts.map((c, i) => {
                const isITM = chainType === 'call' ? c.strike < (stockPrice || 0) : c.strike > (stockPrice || 0)
                const isSelected = selected?.strike === c.strike && selected?.type === c.type
                return (
                  <tr 
                    key={i} 
                    onClick={() => selectContract(c)} 
                    className={isSelected ? 'selected-row' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ fontWeight: 600 }}>${c.strike.toFixed(2)}</td>
                    <td className={isITM ? 'itm-text' : 'otm-text'}>{c.bid.toFixed(2)}</td>
                    <td className={isITM ? 'itm-text' : 'otm-text'}>{c.ask.toFixed(2)}</td>
                    <td>{(c.iv * 100).toFixed(1)}%</td>
                    <td>{c.oi.toLocaleString()}</td>
                    <td>{c.volume.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* SECTION 3 — Simulator panel */}
      {selected && stockPrice && (
        <section className="simulator-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {ticker} ${selected.strike} {selected.type.toUpperCase()} — {selected.expiry}
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                Entry: ${entry.toFixed(2)} · 1 contract · 100 shares
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 600, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                {pnl >= 0 ? '+' : ''}${Math.round(pnl)}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: pnl >= 0 ? '#16a34a' : '#dc2626' }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card" style={{ border: '1px solid #eee' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Break-even</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>${breakeven.toFixed(2)}</div>
            </div>
            <div className="stat-card" style={{ border: '1px solid #eee' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Prob. of Profit</div>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>{(Math.abs(greeks.delta) * 100).toFixed(1)}%</div>
            </div>
            <div className="stat-card" style={{ border: '1px solid #eee' }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Max Loss</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>-${(entry * 100).toFixed(0)}</div>
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { label: 'Custom', id: 'custom' },
                { label: 'Hits strike today', id: 'hits' },
                { label: 'Hold to expiry', id: 'expiry' },
                { label: 'IV crush -30%', id: 'crush' },
                { label: 'IV spike +20%', id: 'spike' }
              ].map(s => (
                <button 
                  key={s.id} 
                  className={`scenario-btn ${activeScenario === s.id ? 'active' : ''}`}
                  onClick={() => applyScenario(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>Stock price at expiry</span>
                <span style={{ fontWeight: 600 }}>${simPrice.toFixed(2)}</span>
              </div>
              <input 
                type="range" 
                min={stockPrice * 0.7} 
                max={stockPrice * 1.3} 
                step={0.1}
                value={simPrice} 
                onChange={e => { setSimPrice(parseFloat(e.target.value)); setActiveScenario('custom'); }} 
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>Days to expiry</span>
                <span style={{ fontWeight: 600 }}>{simDTE}d</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={17} 
                step={1}
                value={simDTE} 
                onChange={e => { setSimDTE(parseInt(e.target.value)); setActiveScenario('custom'); }} 
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                <span>IV change</span>
                <span style={{ fontWeight: 600 }}>{simIV > 0 ? '+' : ''}{simIV}%</span>
              </div>
              <input 
                type="range" 
                min={-50} 
                max={50} 
                step={1}
                value={simIV} 
                onChange={e => { setSimIV(parseInt(e.target.value)); setActiveScenario('custom'); }} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Delta', value: greeks.delta.toFixed(3) },
              { label: 'Gamma', value: greeks.gamma.toFixed(4) },
              { label: 'Theta', value: greeks.theta.toFixed(3) },
              { label: 'Vega', value: greeks.vega.toFixed(3) }
            ].map(g => (
              <div key={g.label} style={{ background: '#f8f8f8', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>{g.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{g.value}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
