# OPTIONS_SIM 📈

A real-time options pricing simulator built with React, TypeScript, and Vite. Fetch a live stock price, browse a generated options chain priced with Black-Scholes, select any contract, and simulate P&L across price moves, time decay, and IV shifts — all in the browser with no backend.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
  - [Black-Scholes Pricing](#black-scholes-pricing)
  - [Greeks Calculation](#greeks-calculation)
  - [Options Chain Generation](#options-chain-generation)
  - [Simulator Panel](#simulator-panel)
- [Roadmap](#roadmap)
- [API Layer](#api-layer)

---

## Features ✨

- 📡 **Live stock prices** via Alpha Vantage API
- 📊 **Options chain** — calls and puts generated around the current price, ITM/OTM highlighted
- 🧮 **Black-Scholes engine** — custom implementation, no external math library
- ⚡ **Live Greeks** — Delta, Gamma, Theta, Vega recalculated on every slider move
- 📉 **P&L simulator** — model any scenario with price, DTE, and IV sliders
- 🎯 **Scenario presets** — one-click shortcuts for common setups (hits strike, IV crush, hold to expiry, IV spike)
- 🔢 **Stat cards** — breakeven price, probability of profit (via delta), and max loss per contract

---

## Tech Stack 🛠️

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript |
| Build | Vite |
| Styling | Vanilla CSS |
| Math | Custom Black-Scholes (no deps) |
| Data | Alpha Vantage REST API |

---

## Getting Started 🚀

```bash
# 1. Clone the repo
git clone https://github.com/Myst1C13/Options-Simulator.git
cd Options-Simulator

# 2. Install dependencies
npm install

# 3. Set up your Alpha Vantage API key
echo "VITE_ALPHA_VANTAGE_KEY=your_key_here" > .env

# 4. Start the dev server
npm run dev
```

Get a free API key at [alphavantage.co](https://www.alphavantage.co/support/#api-key).

> **Note:** The free Alpha Vantage tier is rate-limited to 25 requests/day. The options chain is generated client-side using Black-Scholes so only the stock price fetch hits the API.

---

## Project Structure 📁

```
src/
├── api/
│   └── api.ts          # Alpha Vantage fetch functions
├── lib/
│   └── blackScholes.ts # Black-Scholes pricing engine + Greeks
├── App.tsx             # Root component — all state, chain, simulator
└── App.css             # Styles
```

---

## How It Works 🔬

### Black-Scholes Pricing

**File:** `src/lib/blackScholes.ts`

The `blackScholes()` function takes 6 inputs and returns the theoretical fair value of an option:

| Parameter | Symbol | Description |
|---|---|---|
| `S` | S | Current stock price |
| `K` | K | Strike price |
| `T` | T | Time to expiry in years (e.g. 17 days = `17/365`) |
| `r` | r | Risk-free interest rate (hardcoded at `0.053`) |
| `sigma` | σ | Implied volatility as a decimal (e.g. `0.25` = 25% IV) |
| `type` | — | `'call'` or `'put'` |

The core formula computes two intermediate values first:

```
d1 = ( ln(S/K) + (r + σ²/2) * T ) / ( σ * √T )
d2 = d1 - σ * √T
```

Then the option price:

```
Call price = S * N(d1) - K * e^(-rT) * N(d2)
Put price  = K * e^(-rT) * N(-d2) - S * N(-d1)
```

Where `N(x)` is the cumulative standard normal distribution.

**Normal CDF approximation (`normalCDF`):** Rather than using a lookup table or external library, the CDF is approximated using the Horner method polynomial from Abramowitz & Stegun (formula 26.2.17). It's accurate to ~7 decimal places — more than sufficient for options pricing.

---

### Greeks Calculation

**File:** `src/lib/blackScholes.ts` — `calculateGreeks()`

Greeks measure the sensitivity of the option price to different inputs. All four are derived from the same `d1`/`d2` computed during pricing, plus the standard normal PDF (`φ`):

```
φ(d1) = e^(-0.5 * d1²) / √(2π)
```

| Greek | Measures | Formula |
|---|---|---|
| **Delta** | Price change per $1 move in stock | Call: `N(d1)` · Put: `N(d1) - 1` |
| **Gamma** | Rate of change of Delta | `φ(d1) / (S * σ * √T)` |
| **Theta** | Price decay per calendar day | `(-(S * φ * σ) / (2√T) ∓ r * K * e^(-rT) * N(±d2)) / 365` |
| **Vega** | Price change per 1% IV move | `S * φ(d1) * √T / 100` |

A few things worth noting:
- **Delta doubles as probability of profit** — a 0.40 delta call has roughly a 40% chance of expiring ITM.
- **Theta is divided by 365** to give a per-day figure rather than per-year.
- **Vega is divided by 100** so it represents the dollar change per 1 percentage point of IV, not per unit.

---

### Options Chain Generation

**File:** `src/App.tsx` — `generateMockChain()`

Since Alpha Vantage's real-time options endpoint requires a premium plan, the chain is generated locally using Black-Scholes once a live stock price is fetched.

10 strikes are generated centered on the current price in $2.50 increments:

```ts
const strikes = [-15, -10, -5, -2.5, 0, 2.5, 5, 10, 15, 20].map(
  d => Math.round((stockPrice + d) / 2.5) * 2.5
)
```

For each strike, IV is modeled with a basic volatility smile — IV increases slightly as the strike moves away from the current price:

```ts
const iv = 0.25 + Math.abs(strike - stockPrice) * 0.001
```

Bid/ask are set at ±5% of the theoretical price to simulate a realistic spread:

```ts
bid = theoreticalPrice * 0.95
ask = theoreticalPrice * 1.05
```

Both a call and a put are generated for every strike, giving a complete chain. OI and volume are randomized.

---

### Simulator Panel

**File:** `src/App.tsx`

When you click a contract in the chain, the simulator opens. It re-prices the option in real time as you move the sliders, using the same `blackScholes()` function.

**P&L calculation:**

```ts
entry = (selected.bid + selected.ask) / 2   // mid-price at entry
sigma = max(0.01, selected.iv + simIV / 100) // adjusted IV
currentPrice = blackScholes({ S: simPrice, T: simDTE/365, sigma, ... })
pnl = (currentPrice - entry) * 100           // x100 for one contract
```

**Stat cards:**

| Stat | How it's calculated |
|---|---|
| Breakeven | `strike + entry` for calls, `strike - entry` for puts |
| Prob. of Profit | `abs(delta) * 100` — delta as a percent |
| Max Loss | `entry * 100` — the full premium paid |

**Scenario presets** (`applyScenario`): Each preset snaps the sliders to a specific state to quickly model common situations:

| Preset | What it does |
|---|---|
| Hits strike today | Sets `simPrice` to the strike |
| Hold to expiry | Sets `simDTE` to 0 |
| IV crush -30% | Sets `simIV` to -30 |
| IV spike +20% | Sets `simIV` to +20 |
| Custom | Resets all sliders to entry conditions |

---

## Roadmap 🗺️

Planned improvements and features in no particular order:

- **API migration** — move from Alpha Vantage to Yahoo Finance or a more reliable free data source. Alpha Vantage's free tier is too rate-limited for real use (25 req/day) and the options endpoint is paywalled.
- **Real options chain data** — `fetchOptionsChain()` is already wired up in `api.ts`, just needs a data source that actually returns chain data on a free plan. Once that's in, the mock generator gets replaced with real bids, asks, OI, and volume.
- **UI overhaul** — current layout is functional but not final. Working on a full-width design with a better visual hierarchy — see the `ui-redesign` branch for the WIP.
- **P&L chart** — a payoff diagram showing profit/loss across a range of prices at expiry, instead of just a single simulated value.
- **Multi-leg strategies** — support for spreads (vertical, calendar, iron condor) so you can simulate more than just single contracts.

---

## API Layer 🌐

**File:** `src/api/api.ts`

Two functions wrap the Alpha Vantage API:

```ts
fetchStockPrice(ticker: string): Promise<number>
```
Hits the `GLOBAL_QUOTE` endpoint and returns the current price as a number.

```ts
fetchOptionsChain(ticker: string): Promise<any[]>
```
Hits the `REALTIME_OPTIONS` endpoint. This is defined but not currently used in the UI — the chain is generated client-side via `generateMockChain()`. This is here for when a premium API key is available to swap in real chain data.
