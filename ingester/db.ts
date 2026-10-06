import { Pool } from "./node_modules/@types/pg";
import { config } from "./config";
import type { Candle } from "./yahoo";

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function getLastTs(symbol: string): Promise<Date | null> {
  const { rows } = await pool.query<{ max: Date | null }>(
    "SELECT max(ts) AS max FROM candles_1m WHERE symbol = $1",
    [symbol],
  );
  return rows[0]?.max ?? null;
}

export async function upsertCandles(candles: Candle[]): Promise<void> {
  if (candles.length === 0) return;

  await pool.query(
    `INSERT INTO candles_1m (symbol, ts, open, high, low, close, volume)
     SELECT * FROM unnest(
       $1::text[], $2::timestamptz[],
       $3::float8[], $4::float8[], $5::float8[], $6::float8[], $7::float8[]
     )
     ON CONFLICT (symbol, ts) DO UPDATE SET
       open   = EXCLUDED.open,
       high   = EXCLUDED.high,
       low    = EXCLUDED.low,
       close  = EXCLUDED.close,
       volume = EXCLUDED.volume`,
    [
      candles.map((c) => c.symbol),
      candles.map((c) => c.ts.toISOString()),
      candles.map((c) => c.open),
      candles.map((c) => c.high),
      candles.map((c) => c.low),
      candles.map((c) => c.close),
      candles.map((c) => c.volume),
    ],
  );
}
