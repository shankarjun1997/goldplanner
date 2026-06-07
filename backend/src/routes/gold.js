import { Router } from "express";
import { auth } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();

// Serve cached rates so we don't hit the provider on every request
// (goldapi.io free tier is tightly rate-limited).
const CACHE_TTL_MINUTES = Number(process.env.GOLD_RATE_TTL_MINUTES || 60);

async function latestCached(karat) {
  const { rows } = await pool.query(
    "SELECT rate_per_gram, source, fetched_at FROM gold_rates WHERE karat=$1 ORDER BY fetched_at DESC LIMIT 1",
    [karat]
  );
  return rows[0] || null;
}

async function fetchFromProvider(karat) {
  const resp = await fetch("https://www.goldapi.io/api/XAU/INR", {
    headers: { "x-access-token": process.env.GOLDAPI_KEY, "Content-Type": "application/json" },
  });
  const d = await resp.json();
  // goldapi returns per-gram prices directly for each purity
  const perGram = karat === 24 ? d.price_gram_24k : d.price_gram_22k;
  if (!perGram) throw new Error("no rate returned");
  return Math.round(perGram);
}

r.get("/rate", auth, async (req, res) => {
  const me = (await pool.query("SELECT is_premium FROM users WHERE id=$1", [req.user.id])).rows[0];
  if (!me?.is_premium) return res.status(402).json({ error: "upgrade_required" });

  const karat = req.query.karat === "24" ? 24 : 22;
  const cached = await latestCached(karat);

  // Fresh cache hit → serve without touching the provider.
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MINUTES * 60_000) {
    return res.json({
      karat,
      ratePerGram: Number(cached.rate_per_gram),
      source: cached.source,
      at: cached.fetched_at,
      cached: true,
    });
  }

  try {
    const ratePerGram = await fetchFromProvider(karat);
    await pool.query(
      "INSERT INTO gold_rates (karat, rate_per_gram, source) VALUES ($1, $2, $3)",
      [karat, ratePerGram, "goldapi.io"]
    );
    res.json({ karat, ratePerGram, source: "goldapi.io", at: new Date().toISOString(), cached: false });
  } catch {
    // Provider down or quota hit → fall back to stale cache rather than failing.
    if (cached) {
      return res.json({
        karat,
        ratePerGram: Number(cached.rate_per_gram),
        source: cached.source,
        at: cached.fetched_at,
        cached: true,
        stale: true,
      });
    }
    res.status(502).json({ error: "rate provider unavailable" });
  }
});

export default r;
