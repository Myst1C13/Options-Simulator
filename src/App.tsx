import { useState } from 'react'
import { fetchStockPrice } from './api/polygon'
import { blackScholes, calculateGreeks } from './lib/blackScholes'

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

  const expiry = '2026-04-17'
  const contracts: Contract[] = []

  strikes.forEach(strike => {
    const iv = 0.25 + Math.abs(strike - stockPrice) * 0.001

    const callPrice = blackScholes({
      S: stockPrice,
      K: strike,
      T: 17 / 365,
      r: 0.053,
      sigma: iv,
      type: 'call'
    })

    const putPrice = blackScholes({
      S: stockPrice,
      K: strike,
      T: 17 / 365,
      r: 0.053,
      sigma: iv,
      type: 'put'
    })

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