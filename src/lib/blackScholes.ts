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
    
