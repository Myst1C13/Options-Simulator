import { blackScholes, calculateGreeks } from './lib/blackScholes'

function App() {
  const input = {
    S: 213.49,
    K: 215,
    T: 17 / 365,
    r: 0.053,
    sigma: 0.25,
    type: 'call' as const
  }

  const price = blackScholes(input)
  const greeks = calculateGreeks(input)

  return (
    <div>
      <h1>AAPL $215 Call</h1>
      <p>Price: ${price.toFixed(2)}</p>
      <p>Delta: {greeks.delta.toFixed(3)}</p>
      <p>Gamma: {greeks.gamma.toFixed(4)}</p>
      <p>Theta: {greeks.theta.toFixed(4)}</p>
      <p>Vega: {greeks.vega.toFixed(4)}</p>
    </div>
  )
}

export default App