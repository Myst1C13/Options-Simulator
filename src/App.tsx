function App() {
  const ticker: string = "AAPL"
  const price: number = 213.49
  const isCall: boolean = true

  return (
    <div>
      <h1>{ticker}</h1>
      <p>Current price: ${price}</p>
      <p>Option type: {isCall ? "Call" : "Put"}</p>
    </div>
  )
}

export default App