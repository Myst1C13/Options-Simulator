# OPTIONS_SIM

A clean, minimal, and elegant options pricing simulator built with React, TypeScript, and Vite.

## Features

- **Real-time Stock Data**: Fetches live stock prices using Alpha Vantage API.
- **Interactive Options Chain**: View calls and puts with highlighting for ITM/OTM contracts.
- **Black-Scholes Engine**: Accurate options pricing and Greeks calculations.
- **Simulator Panel**:
  - P&L simulation based on stock price, time to expiry, and IV changes.
  - Live Greeks (Delta, Gamma, Theta, Vega) updates.
  - Quick scenario buttons (Hits strike, IV crush, etc.).
  - Custom range sliders for fine-tuned simulation.
- **Minimalist UI**: Designed with JetBrains Mono for a clean developer-focused aesthetic.

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Vanilla CSS (Customized Range Sliders)
- **Math**: Custom Black-Scholes implementation

## Getting Started

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Create a `.env` file and add your Alpha Vantage API key:
   ```
   VITE_ALPHA_VANTAGE_KEY=your_key_here
   ```
4. Run the development server: `npm run dev`.
