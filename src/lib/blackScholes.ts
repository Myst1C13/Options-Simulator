interface BlackScholes {
    S: number;
    K: number;
    T: number;
    r: number;
    sigma: number;
    type: 'call' | 'put';

}

interface Greeks { 
  delta: number
  gamma: number
  theta: number
  vega: number
}

function normalCDF(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  
  let sign: number
  if (x < 0) {
    sign = -1
  } else {
    sign = 1
  }

  x = Math.abs(x) / Math.sqrt(2)

  const t = 1 / (1 + p * x)

  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  const result = 0.5 * (1 + sign * y)

  return result
}

export function blackScholes(input: BlackScholes): number {

    const { S, K, T, r, sigma, type } = input;

    // At expiry, return intrinsic value — Black-Scholes breaks at T=0
    if (T <= 0) {
      return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0)
    }

    const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
    const d2 = d1 - sigma * Math.sqrt(T)
    if (type === 'call') {
    const price = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
    return price
    } else {
    const price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
    return price
  }
}

export function calculateGreeks(input: BlackScholes): Greeks {
  const { S, K, T, r, sigma, type } = input

  // At expiry Greeks are degenerate — delta is binary, all others are 0
  if (T <= 0) {
    const delta = type === 'call' ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0)
    return { delta, gamma: 0, theta: 0, vega: 0 }
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)

  const phi = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI)

  let delta: number
  if (type === 'call') {
    delta = normalCDF(d1)
  } else {
    delta = normalCDF(d1) - 1
  }

  const gamma = phi / (S * sigma * Math.sqrt(T))

  let theta: number
  if (type === 'call') {
    theta = (-(S * phi * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365
  } else {
    theta = (-(S * phi * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365
  }

  const vega = S * phi * Math.sqrt(T) / 100

  return { delta, gamma, theta, vega }

}

    
