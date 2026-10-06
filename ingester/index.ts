import { config } from "./config";
import { getLastTs, pool, upsertCandles } from "./db";
import { fetchCandles } from "./yahoo";

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let running = true;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`\n${sig} отримано, зупиняюсь після поточного запиту...`);
    running = false;
  });
}

/**
 * Одна функція і для бекфілу, і для поллінгу:
 * від max(ts) в БД (включно, щоб перезаписати незакриту свічку) до "зараз".
 */
async function syncSymbol(symbol: string): Promise<number> {
  const now = new Date();
  const last = await getLastTs(symbol);

  let from = last ?? new Date(now.getTime() - config.backfillDays * DAY_MS);

  // Yahoo не віддає 1m глибше ~7 днів, тому обрізаємо вікно.
  const earliest = new Date(now.getTime() - config.maxLookbackDays * DAY_MS);
  if (from < earliest) from = earliest;

  const candles = await fetchCandles(symbol, from, now, config.interval);
  await upsertCandles(candles);
  return candles.length;
}

const isRateLimit = (e: unknown) =>
  /429|too many requests/i.test(e instanceof Error ? e.message : String(e));

async function runCycle(backoffMs: number): Promise<number> {
  for (const symbol of config.symbols) {
    if (!running) break;
    try {
      const n = await syncSymbol(symbol);
      console.log(`[${new Date().toISOString()}] ${symbol}: +${n} свічок`);
      backoffMs = 0;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[${symbol}] помилка: ${msg}`);
      if (isRateLimit(e)) {
        // Експоненційний backoff: 30с -> 60с -> ... до 10 хв.
        backoffMs = Math.min(backoffMs ? backoffMs * 2 : 30_000, 10 * 60_000);
        console.warn(`Rate limit, чекаю ${backoffMs / 1000}с`);
        await sleep(backoffMs);
      }
    }
    await sleep(config.symbolDelayMs);
  }
  return backoffMs;
}

async function main() {
  console.log(
    `Старт: ${config.symbols.length} символів, інтервал ${config.interval}, цикл ${config.pollIntervalMs / 1000}с`,
  );

  let backoffMs = 0;
  while (running) {
    const started = Date.now();
    backoffMs = await runCycle(backoffMs);

    // Чекаємо залишок часу до наступного циклу (якщо цикл затягнувся, стартуємо одразу).
    const wait = Math.max(0, config.pollIntervalMs - (Date.now() - started));
    const end = Date.now() + wait;
    while (running && Date.now() < end)
      await sleep(Math.min(500, end - Date.now()));
  }

  await pool.end();
  console.log("Зупинено.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
