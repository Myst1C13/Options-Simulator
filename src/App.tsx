import { useState } from 'react'
import type { FormEvent } from 'react'
import { fetchOptionsChain, fetchStockPrice } from './api/api'
import { blackScholes, calculateGreeks } from './lib/blackScholes'
import './App.css'

const RISK_FREE_RATE = 0.053

type ContractType = 'call' | 'put'
type ChainMode = 'idle' | 'realtime' | 'unavailable'

interface Contract {
  strike: number
  expiry: string
  type: ContractType
  bid: number
  ask: number
  iv: number
  oi: number
  volume: number
}

interface ChainLoadResult {
  contracts: Contract[]
  mode: ChainMode
  note: string
}

interface MetricCardProps {
  label: string
  value: string
}

interface RangeFieldProps {
  label: string
  min: number
  max: number
  step: number
  value: number
  displayValue: string
  onChange: (value: number) => void
}

function formatCurrency(value: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function formatSignedCurrency(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${formatCurrency(value, 0)}`
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

function formatExpiryLabel(expiry: string): string {
  return new Date(`${expiry}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getNextFriday(from = new Date()): string {
  const next = new Date(from)
  const day = next.getDay()
  const daysUntil = ((5 - day + 7) % 7) || 7
  next.setDate(next.getDate() + daysUntil)
  return toYMD(next)
}

function toYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDaysToExpiry(expiry: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiration = new Date(`${expiry}T00:00:00`)

  return Math.max(
    0,
    Math.round((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  )
}

function getUpcomingFridays(count: number): string[] {
  const results: string[] = []
  const cursor = new Date()

  while (results.length < count) {
    const expiry = getNextFriday(cursor)
    if (!results.includes(expiry)) {
      results.push(expiry)
    }
    cursor.setDate(cursor.getDate() + 7)
  }

  return results
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = Number(value.replaceAll(',', '').trim())
    return Number.isFinite(normalized) ? normalized : null
  }
  return null
}

function firstRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record) return record[key]
  }
  return null
}

function parseContractSymbol(contractSymbol: string): { expiry?: string; type?: ContractType } {
  const match = contractSymbol.toUpperCase().match(/(\d{2})(\d{2})(\d{2})([CP])\d{8}$/)
  if (!match) return {}

  const [, year, month, day, right] = match
  return {
    expiry: `20${year}-${month}-${day}`,
    type: right === 'C' ? 'call' : 'put',
  }
}

function normalizeContractType(value: unknown, contractSymbol?: string): ContractType | null {
  if (typeof value === 'string') {
    const normalized = value.toLowerCase()
    if (normalized === 'call' || normalized === 'c') return 'call'
    if (normalized === 'put' || normalized === 'p') return 'put'
  }

  if (contractSymbol) {
    return parseContractSymbol(contractSymbol).type ?? null
  }

  return null
}

function parseOptionsApiChain(data: unknown[], expiry: string): Contract[] {
  return data
    .map(item => {
      if (!item || typeof item !== 'object') return null

      const record = item as Record<string, unknown>
      const contractSymbolValue = firstRecordValue(record, [
        'contractID',
        'contractId',
        'contract',
        'symbol',
      ])
      const contractSymbol =
        typeof contractSymbolValue === 'string' ? contractSymbolValue : undefined
      const parsedContractSymbol = contractSymbol ? parseContractSymbol(contractSymbol) : {}

      const contractExpiryValue = firstRecordValue(record, [
        'expiration',
        'expiry',
        'expiration_date',
      ])
      const contractExpiry =
        typeof contractExpiryValue === 'string'
          ? contractExpiryValue
          : parsedContractSymbol.expiry ?? expiry

      const type = normalizeContractType(
        firstRecordValue(record, ['type', 'option_type', 'right']),
        contractSymbol,
      )
      const strike = toNumber(firstRecordValue(record, ['strike', 'strike_price']))
      const bid = toNumber(firstRecordValue(record, ['bid', 'best_bid']))
      const ask = toNumber(firstRecordValue(record, ['ask', 'best_ask']))
      const last = toNumber(firstRecordValue(record, ['last', 'mark', 'last_price']))
      const impliedVolatility = toNumber(
        firstRecordValue(record, ['implied_volatility', 'impliedVolatility', 'iv']),
      )
      const openInterest = toNumber(firstRecordValue(record, ['open_interest', 'oi']))
      const volume = toNumber(firstRecordValue(record, ['volume']))

      if (!type || strike === null) return null
      if (contractExpiry !== expiry) return null

      const mark = last ?? bid ?? ask ?? 0
      const cleanBid = Math.max(0, bid ?? Math.max(mark - 0.05, 0))
      const cleanAsk = Math.max(cleanBid, ask ?? mark ?? cleanBid)
      const cleanIv = impliedVolatility === null
        ? 0.25
        : impliedVolatility > 1
          ? impliedVolatility / 100
          : impliedVolatility

      return {
        strike,
        expiry: contractExpiry,
        type,
        bid: Number(cleanBid.toFixed(2)),
        ask: Number(cleanAsk.toFixed(2)),
        iv: Math.max(0.01, cleanIv),
        oi: Math.max(0, Math.round(openInterest ?? 0)),
        volume: Math.max(0, Math.round(volume ?? 0)),
      }
    })
    .filter((contract): contract is Contract => contract !== null)
    .sort((a, b) => a.strike - b.strike)
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="metric-card">
      <span className="metric-card__label">{label}</span>
      <strong className="metric-card__value">{value}</strong>
    </div>
  )
}

function RangeField({
  label,
  min,
  max,
  step,
  value,
  displayValue,
  onChange,
}: RangeFieldProps) {
  return (
    <label className="range-field">
      <span className="range-field__header">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </label>
  )
}

async function loadChain(
  ticker: string,
  expiry: string,
): Promise<ChainLoadResult> {
  try {
    const liveData = await fetchOptionsChain(ticker, expiry)
    const liveContracts = parseOptionsApiChain(liveData, expiry)

    if (liveContracts.length > 0) {
      return {
        contracts: liveContracts,
        mode: 'realtime',
        note: 'source :: realtime options chain',
      }
    }
  } catch {
    // Fall back below when realtime options are unavailable.
  }

  return {
    contracts: [],
    mode: 'unavailable',
    note: 'source :: realtime options unavailable',
  }
}

function App() {
  const expiryOptions = getUpcomingFridays(16)

  const [ticker, setTicker] = useState('')
  const [expiry, setExpiry] = useState('')
  const [stockPrice, setStockPrice] = useState<number | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [selected, setSelected] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [chainType, setChainType] = useState<ContractType>('call')
  const [chainMode, setChainMode] = useState<ChainMode>('idle')
  const [chainNote, setChainNote] = useState('source :: waiting for quote')
  const [simPrice, setSimPrice] = useState(0)
  const [simDTE, setSimDTE] = useState(() => getDaysToExpiry(getNextFriday()))
  const [simIV, setSimIV] = useState(0)

  const dte = expiry ? getDaysToExpiry(expiry) : 0
  const filteredContracts = contracts.filter(contract => contract.type === chainType)
  const openInterest = filteredContracts.reduce((sum, contract) => sum + contract.oi, 0)
  const totalVolume = filteredContracts.reduce((sum, contract) => sum + contract.volume, 0)
  const priceSliderStep = 0.1

  async function refreshChain(symbol: string, livePrice: number, nextExpiry: string) {
    const result = await loadChain(symbol, nextExpiry)
    setContracts(result.contracts)
    setChainMode(result.mode)
    setChainNote(result.note)
    setSelected(null)
    setSimPrice(livePrice)
    setSimDTE(getDaysToExpiry(nextExpiry))
    setSimIV(0)
  }

  async function handleFetch() {
    const normalizedTicker = ticker.trim().toUpperCase()
    if (!normalizedTicker) {
      setError('Error: enter a ticker first.')
      return
    }

    if (!expiry) {
      setError('Error: select an expiry first.')
      return
    }

    setTicker(normalizedTicker)
    setLoading(true)
    setError('')

    try {
      const price = await fetchStockPrice(normalizedTicker)
      if (!Number.isFinite(price)) {
        throw new Error('Invalid price response')
      }

      setStockPrice(price)
      await refreshChain(normalizedTicker, price, expiry)
    } catch {
      setError(
        import.meta.env.VITE_ALPHA_VANTAGE_KEY
          ? 'Error: quote fetch failed or rate limit hit.'
          : 'Error: add VITE_ALPHA_VANTAGE_KEY to .env for live data.',
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void handleFetch()
  }

  async function handleExpiryChange(nextExpiry: string) {
    setExpiry(nextExpiry)
    setSimDTE(nextExpiry ? getDaysToExpiry(nextExpiry) : 0)
    setError('')

    if (stockPrice) {
      setLoading(true)
      try {
        await refreshChain(ticker, stockPrice, nextExpiry)
      } finally {
        setLoading(false)
      }
    }
  }

  function selectContract(contract: Contract) {
    setSelected(contract)
    setChainType(contract.type)
    setSimPrice(stockPrice ?? contract.strike)
    setSimDTE(dte)
    setSimIV(0)
  }

  let entryPrice = 0
  let currentPrice = 0
  let pnl = 0
  let breakeven = 0
  let greeks = { delta: 0, gamma: 0, theta: 0, vega: 0 }

  if (selected) {
    entryPrice = (selected.bid + selected.ask) / 2
    breakeven =
      selected.type === 'call' ? selected.strike + entryPrice : selected.strike - entryPrice

    currentPrice = blackScholes({
      S: simPrice || stockPrice || selected.strike,
      K: selected.strike,
      T: simDTE / 365,
      r: RISK_FREE_RATE,
      sigma: Math.max(0.01, selected.iv + simIV / 100),
      type: selected.type,
    })

    greeks = calculateGreeks({
      S: simPrice || stockPrice || selected.strike,
      K: selected.strike,
      T: simDTE / 365,
      r: RISK_FREE_RATE,
      sigma: Math.max(0.01, selected.iv + simIV / 100),
      type: selected.type,
    })

    pnl = (currentPrice - entryPrice) * 100
  }

  return (
    <div className="terminal-app">
      <main className="terminal-shell">
        <section className="terminal-panel terminal-panel--intro">
          <div className="terminal-kicker">Options Simulator</div>
          <h1>Returns Slider for Options Contracts</h1>
          <p className="terminal-copy">
            One page. Simple controls. Live spot first, then one contract, then
            a smooth return slider that lets you stress price, time, and IV.
          </p>

          <div className="metrics-grid">
            <MetricCard
              label="spot"
              value={stockPrice ? formatCurrency(stockPrice) : 'waiting'}
            />
            <MetricCard
              label="expiry"
              value={expiry ? `${formatExpiryLabel(expiry)} :: ${dte}d` : 'Select expiry'}
            />
            <MetricCard
              label="chain"
              value={chainMode === 'realtime' ? 'Realtime' : chainMode === 'unavailable' ? 'Unavailable' : 'Idle'}
            />
            <MetricCard
              label="focus"
              value={selected ? `${formatCurrency(selected.strike)} ${selected.type}` : 'none'}
            />
          </div>
        </section>

        <section className="terminal-panel">
          <form className="command-bar" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field__label">Ticker</span>
              <input
                value={ticker}
                onChange={event => setTicker(event.target.value.toUpperCase())}
                placeholder="Enter ticker"
                maxLength={8}
              />
            </label>

            <label className="field">
              <span className="field__label">Expiry</span>
              <select value={expiry} onChange={event => void handleExpiryChange(event.target.value)}>
                <option value="">Select expiry</option>
                {expiryOptions.map(option => (
                  <option key={option} value={option}>
                    {formatExpiryLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Quote + Chain'}
            </button>
          </form>

          <div className="terminal-line">
            <span>{chainNote}</span>
            <span>contracts :: {filteredContracts.length}</span>
            <span>oi :: {filteredContracts.length ? formatCompactNumber(openInterest) : '0'}</span>
            <span>vol :: {filteredContracts.length ? formatCompactNumber(totalVolume) : '0'}</span>
          </div>

          {chainMode === 'unavailable' && (
            <div className="terminal-banner">
              Realtime option prices were not available from the API. I am not showing a modeled
              chain here because theoretical Black-Scholes values are not the same as real option
              closing prices.
            </div>
          )}

          {error && <div className="terminal-banner terminal-banner--error">{error}</div>}
        </section>

        <section className="workspace">
            <article className={`terminal-panel ${selected ? '' : 'terminal-panel--full'}`}>
              <div className="panel-head">
                <div>
                  <div className="terminal-kicker">Chain</div>
                  <h2>{ticker} {chainType === 'call' ? 'Calls' : 'Puts'}</h2>
                </div>

                <div className="panel-meta">
                  <span>{expiry ? formatExpiryLabel(expiry) : 'No expiry selected'}</span>
                  {stockPrice && <span>spot :: {formatCurrency(stockPrice)}</span>}
                </div>
              </div>

                <div className="segmented-control">
                  {(['call', 'put'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      className={chainType === type ? 'is-active' : ''}
                      onClick={() => setChainType(type)}
                    >
                      {type === 'call' ? 'Call' : 'Put'}
                    </button>
                  ))}
                </div>

            <div className="table-shell">
              <table className="chain-table">
                <thead>
                  <tr>
                    <th>strike</th>
                    <th>bid</th>
                    <th>ask</th>
                    <th>iv</th>
                    <th>oi</th>
                    <th>vol</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.length > 0 ? (
                    filteredContracts.map(contract => {
                      const isSelected =
                        selected?.strike === contract.strike &&
                        selected?.type === contract.type &&
                        selected?.expiry === contract.expiry

                      return (
                        <tr
                          key={`${contract.type}-${contract.expiry}-${contract.strike}`}
                          className={isSelected ? 'is-selected' : ''}
                          onClick={() => selectContract(contract)}
                        >
                          <td>{formatCurrency(contract.strike)}</td>
                          <td>{formatCurrency(contract.bid)}</td>
                          <td>{formatCurrency(contract.ask)}</td>
                          <td>{formatPercent(contract.iv * 100)}</td>
                          <td>{contract.oi.toLocaleString()}</td>
                          <td>{contract.volume.toLocaleString()}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td className="chain-table__empty" colSpan={6}>
                        {stockPrice
                          ? 'Realtime option prices are unavailable for this symbol / expiry with the current data source.'
                          : 'Fetch a quote to load the chain'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

              <article className="terminal-panel simulator-panel">
            {selected ? (
              <>
                <div className="panel-head">
                  <div>
                    <div className="terminal-kicker">Return Slider</div>
                    <h2>
                      {ticker} {formatCurrency(selected.strike)} {selected.type}
                    </h2>
                  </div>

                  <div className={`pnl-readout ${pnl >= 0 ? 'is-positive' : 'is-negative'}`}>
                    {formatSignedCurrency(pnl)}
                  </div>
                </div>

                <div className="metrics-grid metrics-grid--compact">
                  <MetricCard label="mark" value={formatCurrency(currentPrice)} />
                  <MetricCard label="breakeven" value={formatCurrency(breakeven)} />
                  <MetricCard
                    label="pop"
                    value={formatPercent(Math.abs(greeks.delta) * 100)}
                  />
                  <MetricCard
                    label="max loss"
                    value={formatCurrency(entryPrice * 100, 0)}
                  />
                </div>

                <div className="slider-stack">
                  <RangeField
                    label="underlying"
                    min={Math.max(1, (stockPrice || selected.strike) * 0.7)}
                    max={(stockPrice || selected.strike) * 1.3}
                    step={priceSliderStep}
                    value={simPrice}
                    displayValue={formatCurrency(simPrice, 2)}
                    onChange={setSimPrice}
                  />

                  <RangeField
                    label="days to expiry"
                    min={0}
                    max={Math.max(dte, 1)}
                    step={1}
                    value={simDTE}
                    displayValue={`${simDTE}d`}
                    onChange={setSimDTE}
                  />

                  <RangeField
                    label="iv shift"
                    min={-50}
                    max={50}
                    step={0.5}
                    value={simIV}
                    displayValue={`${simIV > 0 ? '+' : ''}${simIV.toFixed(1)}%`}
                    onChange={setSimIV}
                  />
                </div>

                <div className="metrics-grid metrics-grid--compact">
                  <MetricCard label="delta" value={greeks.delta.toFixed(3)} />
                  <MetricCard label="gamma" value={greeks.gamma.toFixed(4)} />
                  <MetricCard label="theta" value={greeks.theta.toFixed(3)} />
                  <MetricCard label="vega" value={greeks.vega.toFixed(3)} />
                </div>
              </>
            ) : (
              <div className="empty-simulator">
                <div className="terminal-kicker">Setup</div>
                <h2>Pick One Contract</h2>
                <p>
                  The right side stays simple on purpose. Select one row from the chain and this
                  panel becomes the scenario slider.
                </p>
                <div className="setup-card">
                  <strong>Local setup</strong>
                  <span>Create a local <code>.env</code> file with:</span>
                  <code>VITE_ALPHA_VANTAGE_KEY=your_key_here</code>
                  <span>
                    Product note: don&apos;t put GitHub or README links in the main UI. Keep setup
                    guidance small and local, then replace it later with a backend.
                  </span>
                  <span>
                    Important: correct option close prices have to come from a real options data
                    provider. A pricing model can estimate theoretical value, but it cannot recreate
                    the market&apos;s actual close for every contract.
                  </span>
                </div>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  )
}

export default App
