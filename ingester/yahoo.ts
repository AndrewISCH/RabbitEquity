import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export type Candle = {
  symbol: string;
  ts: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export async function fetchCandles(
  symbol: string,
  from: Date,
  to: Date,
  interval: "1m" | "2m" | "5m" | "15m" | "30m" | "60m" | "1h" | "1d",
): Promise<Candle[]> {
  const result = await yahooFinance.chart(symbol, {
    period1: from,
    period2: to,
    interval,
  });

  const candles: Candle[] =
    result?.quotes
      ?.filter(
        (q) =>
          !(
            q.open == null ||
            q.high == null ||
            q.low == null ||
            q.close == null
          ),
      )
      .map((q) => ({
        symbol,
        ts: q.date!,
        open: q.open!,
        high: q.high!,
        low: q.low!,
        close: q.close!,
        volume: q.volume ?? 0,
      })) ?? [];
  return candles;
}
