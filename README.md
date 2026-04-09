# OPTIONS_SIM 📈

A minimal options pricing simulator built with React, TypeScript, and Vite. Fetch live stock prices, explore the options chain, and simulate P&L scenarios in real time.

---

## Features

**Options Chain** 📊
- Fetches live stock prices via Alpha Vantage API
- Generates a full options chain (calls & puts) around the current price
- ITM/OTM highlighting so you can read the chain at a glance

**Black-Scholes Engine** 🧮
- Custom Black-Scholes implementation for accurate options pricing
- Real-time Greeks: Delta, Gamma, Theta, Vega

**Simulator Panel** ⚙️
- Select any contract from the chain to open the simulator
- Adjust stock price, days to expiry, and IV change with sliders
- Instant P&L, breakeven, probability of profit, and max loss
- Quick scenario presets:
  - Hits strike today
  - Hold to expiry
  - IV crush (-30%)
  - IV spike (+20%)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript |
| Build | Vite |
| Styling | Vanilla CSS |
| Math | Custom Black-Scholes |
| Data | Alpha Vantage API |

---

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/Myst1C13/Options-Simulator.git
cd Options-Simulator

# 2. Install dependencies
npm install

# 3. Add your Alpha Vantage API key
echo "VITE_ALPHA_VANTAGE_KEY=your_key_here" > .env

# 4. Start the dev server
npm run dev
```

Get a free API key at [alphavantage.co](https://www.alphavantage.co/support/#api-key).

---

## Project Structure

```
src/
├── api/
│   └── api.ts          # Alpha Vantage fetch logic
├── lib/
│   └── blackScholes.ts # B-S pricing + Greeks
├── App.tsx             # Main app — chain, simulator, state
└── App.css             # Styles
```
