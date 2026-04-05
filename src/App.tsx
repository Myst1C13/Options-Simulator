import { blackScholes } from './lib/blackScholes'

function App() {
  const result = blackScholes({
    S: 213.49,
    K: 215,
    T: 17/365,
    r: 0.053,
    sigma: 0.25,
    type: "call"
  })

  return (
    <div>
      <h1> AAPL $215 Call</h1>
      <p>Black Scholes price: ${result.toFixed(2)}</p>
    </div>
  )
}

export default App