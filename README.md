# JustFX · ICT/SMC Trading Analysis Dashboard

A complete, functional, secure, online **ICT/SMC Trading Analysis Dashboard** engineered specifically for intraday scalping. It analyzes live market prices and candles, deterministically detects Inner Circle Trader (ICT) and Smart Money Concepts (SMC) setups, displays confirmed signals on an interactive TradingView-style candlestick chart, explains why each signal was generated, tracks simulated trade outcomes, backtests strategies, warns against scheduled economic releases, and provides MetaTrader 5 history import with behavioral revenge-trading detection.

---

## 1. Supported Instruments & Timeframes

### Supported Instruments
- **XAUUSD** — Gold / US Dollar (via Yahoo Finance spot/futures engine `GC=F`)
- **XAGUSD** — Silver / US Dollar (via Yahoo Finance spot/futures engine `SI=F`)
- **EURUSD** — Euro / US Dollar (via Yahoo Finance `EURUSD=X`)
- **BTCUSD** — Bitcoin / US Dollar (via Binance public WebSocket & REST engine `BTCUSDT`, with Yahoo `BTC-USD` fallback)

### Supported Timeframes
- `1m` (1 minute)
- `3m` (3 minutes — dynamically resampled from 1m base candles)
- `5m` (5 minutes)
- `15m` (15 minutes)
- `1h` (1 hour)
- `4h` (4 hours — dynamically resampled from 1h base candles)
- `1d` (1 day)

---

## 2. Market Data Architecture & Verified Free-Tier Feeds

The budget for market data is ₹0. The system leverages:
1. **Binance Public API & WebSocket**:
   - Zero authentication required.
   - REST candle history plus a public trade stream for `BTCUSD`; incoming trades update the active chart candle.
2. **Yahoo Finance Engine**:
   - REST chart candles for `XAUUSD`, `XAGUSD`, and `EURUSD`.
   - The dashboard requests candle refreshes every 6 seconds. This is a polling interval, not a promise of a new tick every 6 seconds; the feed may return the same candle until its data changes.
3. **Data Integrity & Validation Engine** (`src/lib/market-data/validator.ts`):
   - Automatic timestamp normalization (Unix seconds).
   - Deduplication of repeated timestamps, keeping the most complete or higher volume candle.
   - Out-of-order sequence correction.
   - Missing candle gap detection.
   - Stale data detection (> 3 intervals missed). If disconnected or stale, flags status in UI and suppresses provisional signals.
   - Empty or failed feeds return an error status and leave a visible message in the chart area.

---

## 3. Deterministic ICT/SMC Engine

Every ICT/SMC concept is computed mathematically from closed candles without decorative guesswork:
- **Fair Value Gap (FVG)**: 3-candle imbalance. Bullish when `Candle[i-2].high < Candle[i].low`; Bearish when `Candle[i-2].low > Candle[i].high`. Midpoint / Consequent Encroachment (C.E.) tracked.
- **Inverse FVG (IFVG)**: When price closes through the boundary of an unmitigated FVG, it flips into an opposing support/resistance zone.
- **Liquidity Sweeps**: Fractal swing high/low pivots swept by wicks with candle close rejecting back inside.
- **Strong Displacement**: Candle body &ge; 1.8x ATR(14) with body-to-range ratio &ge; 70%.
- **Order Blocks (OB)**: Last opposing candle immediately preceding a confirmed displacement run that breaks structure and leaves an FVG.
- **Change in State of Delivery (CISD)**: Aggressive candle close through reference open/extreme following a sweep.
- **Premium / Discount Dealing Range**: Dealing range equilibrium `(High + Low) / 2`. Buys favored in Discount (&lt; 50%); Sells favored in Premium (&gt; 50%).
- **Silver Bullet Windows**:
  - London/NY Overlap: 03:00–04:00 NY Time
  - NY AM Session: 10:00–11:00 NY Time
  - Automatically converts `America/New_York` to `Asia/Kolkata` (IST) with full Daylight Saving Time (DST) adaptation.

---

## 4. Entry Models & Strictness Configuration

- **Models**:
  1. *Silver Bullet Scalp*: Sweep + Displacement + FVG inside Silver Bullet Time Window.
  2. *Sweep + MSS + Order Block*: Key liquidity sweep followed by market structure shift and OB mitigation.
  3. *IFVG Inversion*: Failed FVG flipped into support/resistance with CISD confirmation.
- **Strictness**:
  - *Standard*: Requires confirmation score &ge; 50% and minimum Risk-to-Reward &ge; 1.5.
  - *Strict*: Requires confirmation score &ge; 70%, mandatory Higher Timeframe (HTF) trend alignment, and minimum Risk-to-Reward &ge; 2.0.
- **Suggested Levels**:
  - Stop Loss: Placed at structural sweep extreme with pip buffer.
  - Take Profit: Placed at opposing liquidity pool or minimum R:R target.

---

## 5. Portfolios & Backtesting

1. **Simulated Signal Portfolio**:
   - Independent persistent tracking of simulated setups.
   - Tracks Limit Entry activation, Stop Loss, and Take Profit.
   - **Ambiguous Candle Resolution**: If High &ge; TP and Low &le; SL on the same candle, marks as `AMBIGUOUS` with conservative accounting. Never guesses.
2. **Actual MetaTrader 5 (MT5) Portfolio**:
   - Completely separated from simulated signals.
   - In-browser MT5 CSV / HTML statement importer.
   - Standalone local Python bridge script (`scripts/mt5_bridge.py`) for live local terminal sync.
   - **Revenge Trading Behavioral Detection**: Flags rapid re-entry after a loss (&lt; 5 mins) and lot size escalation (Martingale tilt).
3. **Historical Backtesting Engine**:
   - Deterministic backtester over up to 90 days of candle history.
   - Strictly prevents look-ahead bias (signals generated on closed candles, entry evaluated on subsequent candles).
   - Generates Win Rate, Profit Factor, Max Drawdown %, Net R, and SVG equity curve.

---

## 6. Economic News Warnings

- Ingests from FairEconomy / ForexFactory API (`https://nfs.faireconomy.media/ff_calendar_thisweek.json`).
- Filters High and Medium impact events for USD, EUR, GBP.
- Alerts at 30 minutes, 15 minutes, and 5 minutes prior to scheduled release.
- **Informational only**: News warnings never alter or block algorithmic trade signals.

---

## 7. Local Development & Testing Instructions

### Prerequisites
- Node.js &ge; 18 (Tested on v22.14.0)
- npm &ge; 9 (Tested on 11.2.0)
- Python 3.11 (optional for MT5 desktop bridge)

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Synchronize database
npx prisma generate
npx prisma db push

# 3. Run automated test suite
npm test

# 4. Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Default demo credentials: `demo@justfx.com` / `DemoTrader2025!`

---

## 8. Online Production Deployment (Vercel)

The app keeps SQLite for local development and uses PostgreSQL in production. Vercel's build command in `vercel.json` generates the PostgreSQL Prisma client and applies the checked-in migrations before building the Next.js app.

1. Push the project to a GitHub repository and import it into Vercel.
2. Create a hosted PostgreSQL database (for example, Neon) and set these Vercel environment variables for Production:
   - `DATABASE_URL`: the pooled Neon connection string used by the app.
   - `DIRECT_URL`: the direct Neon connection string used for schema migrations.
   - `JWT_SECRET`: a unique, random secret with at least 32 bytes of entropy.
3. Deploy. The first build creates the production tables by applying `prisma/migrations`.

Do not commit `.env` or paste production secrets into source files. `.gitignore` excludes local environment files and databases. No Twelve Data or Finnhub keys are needed for the default Binance/Yahoo market feeds.
