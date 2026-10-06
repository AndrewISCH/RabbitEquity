const num = (v: string | undefined, d: number) => (v ? Number(v) : d);

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://postgres:postgres@localhost:5432/trading",

  // Символи через кому. BTC-USD торгується цілодобово, зручно для дебагу у вихідні.
  symbols: (process.env.SYMBOLS ?? "AAPL,MSFT,NVDA,BTC-USD")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  interval: "1m" as const,

  // Як часто стартує новий цикл по всіх символах.
  pollIntervalMs: num(process.env.POLL_INTERVAL_MS, 60_000),
  // Пауза між запитами по окремих символах, щоб не ловити 429.
  symbolDelayMs: num(process.env.SYMBOL_DELAY_MS, 500),

  // Скільки днів історії тягнути, якщо в БД ще нічого немає.
  backfillDays: num(process.env.BACKFILL_DAYS, 5),
  // Yahoo дозволяє 1m лише за ~7 днів в одному запиті, беремо з запасом.
  maxLookbackDays: 6.9,
};
