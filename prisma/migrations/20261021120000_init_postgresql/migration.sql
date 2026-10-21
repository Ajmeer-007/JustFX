-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedInstrument" TEXT NOT NULL DEFAULT 'XAUUSD',
    "selectedTimeframe" TEXT NOT NULL DEFAULT '5m',
    "enabledInstruments" TEXT NOT NULL DEFAULT '["XAUUSD","XAGUSD","EURUSD","BTCUSD"]',
    "overlaySettings" TEXT NOT NULL DEFAULT '{"fvg":true,"ifvg":true,"cisd":true,"sweeps":true,"orderBlocks":true,"displacement":true,"premiumDiscount":true,"silverBullet":true,"htfContext":true}',
    "signalMarkerStyle" TEXT NOT NULL DEFAULT 'detailed',
    "entryModel" TEXT NOT NULL DEFAULT 'silver_bullet',
    "strictnessMode" TEXT NOT NULL DEFAULT 'standard',
    "slTpSettings" TEXT NOT NULL DEFAULT '{"slType":"structural","tpType":"liquidity_or_rr","minRR":2.0}',
    "htfTimeframe" TEXT NOT NULL DEFAULT '1h',
    "marketDirectionMethod" TEXT NOT NULL DEFAULT 'ict_structure',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDrawing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "toolType" TEXT NOT NULL,
    "points" TEXT NOT NULL,
    "properties" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDrawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalRecord" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION NOT NULL,
    "riskReward" DOUBLE PRECISION NOT NULL,
    "confirmationScore" INTEGER NOT NULL,
    "entryModel" TEXT NOT NULL,
    "strictnessMode" TEXT NOT NULL,
    "htfDirection" TEXT,
    "indicators" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "timestampNy" TEXT NOT NULL,
    "timestampIst" TEXT NOT NULL,
    "candleTimestamp" INTEGER NOT NULL,
    "entryTimestamp" INTEGER,
    "exitTimestamp" INTEGER,
    "outcomeR" DOUBLE PRECISION,
    "dataSource" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalId" TEXT,
    "instrument" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit" DOUBLE PRECISION NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "pnlR" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mt5Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticket" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradeType" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "openPrice" DOUBLE PRECISION NOT NULL,
    "closeTime" TIMESTAMP(3),
    "closePrice" DOUBLE PRECISION,
    "sl" DOUBLE PRECISION,
    "tp" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION DEFAULT 0,
    "swap" DOUBLE PRECISION DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL,
    "revengeFlag" BOOLEAN NOT NULL DEFAULT false,
    "revengeReason" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mt5Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicEventCache" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "forecast" TEXT,
    "previous" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EconomicEventCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "UserDrawing_userId_instrument_timeframe_idx" ON "UserDrawing"("userId", "instrument", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "SignalRecord_signalId_key" ON "SignalRecord"("signalId");

-- CreateIndex
CREATE INDEX "SignalRecord_instrument_timeframe_candleTimestamp_idx" ON "SignalRecord"("instrument", "timeframe", "candleTimestamp");

-- CreateIndex
CREATE INDEX "SignalRecord_status_idx" ON "SignalRecord"("status");

-- CreateIndex
CREATE INDEX "PaperTrade_userId_instrument_idx" ON "PaperTrade"("userId", "instrument");

-- CreateIndex
CREATE INDEX "Mt5Trade_userId_symbol_idx" ON "Mt5Trade"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "Mt5Trade_userId_ticket_key" ON "Mt5Trade"("userId", "ticket");

-- CreateIndex
CREATE UNIQUE INDEX "EconomicEventCache_externalId_key" ON "EconomicEventCache"("externalId");

-- CreateIndex
CREATE INDEX "EconomicEventCache_currency_impact_eventTime_idx" ON "EconomicEventCache"("currency", "impact", "eventTime");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDrawing" ADD CONSTRAINT "UserDrawing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mt5Trade" ADD CONSTRAINT "Mt5Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

