import { Router } from "express";
import { auth } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();

r.get("/rate", auth, async (req, res) => {
  const me = (await pool.query("SELECT is_premium FROM users WHERE id=$1", [req.user.id])).rows[0];
  if (!me?.is_premium) return res.status(402).json({ error: "upgrade_required" });

  const karat = req.query.karat === "24" ? "24" : "22";
  try {
    const resp = await fetch("https://www.goldapi.io/api/XAU/INR", {
      headers: { "x-access-token": process.env.GOLDAPI_KEY, "Content-Type": "application/json" },
    });
    const d = await resp.json();
    // goldapi returns per-gram prices directly for each purity
    const perGram = karat === "24" ? d.price_gram_24k : d.price_gram_22k;
    if (!perGram) return res.status(502).json({ error: "no rate returned" });
    res.json({ karat: Number(karat), ratePerGram: Math.round(perGram), source: "goldapi.io", at: new Date().toISOString() });
  } catch {
    res.status(502).json({ error: "rate provider unavailable" });
  }
});

export default r;
