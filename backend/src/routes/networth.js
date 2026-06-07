import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();

r.use(auth);

async function latestRate(karat) {
  const { rows } = await pool.query(
    "SELECT rate_per_gram, fetched_at FROM gold_rates WHERE karat=$1 ORDER BY fetched_at DESC LIMIT 1",
    [karat]
  );
  return rows[0] ? { rate: Number(rows[0].rate_per_gram), at: rows[0].fetched_at } : null;
}

r.get(
  "/",
  ah(async (req, res) => {
    const [{ rows: assets }, r22, r24] = await Promise.all([
      pool.query(
        `SELECT a.member_id, a.kind, a.weight_grams, a.karat, m.name AS member_name
         FROM assets a LEFT JOIN family_members m ON m.id = a.member_id
         WHERE a.user_id=$1`,
        [req.user.id]
      ),
      latestRate(22),
      latestRate(24),
    ]);

    // Karat-appropriate rate per asset; fall back to the other karat if one is missing.
    const rateFor = (karat) =>
      karat === 24 ? (r24 ?? r22)?.rate ?? null : (r22 ?? r24)?.rate ?? null;
    const headline = r22 ?? r24;

    let totalGrams = 0;
    let totalValue = headline ? 0 : null;
    const byKind = new Map();
    const byMember = new Map();

    for (const a of assets) {
      const grams = Number(a.weight_grams);
      const rate = rateFor(a.karat);
      const value = rate != null ? Math.round(grams * rate) : null;
      totalGrams += grams;
      if (totalValue != null && value != null) totalValue += value;

      const k = byKind.get(a.kind) || { kind: a.kind, grams: 0, value: headline ? 0 : null };
      k.grams += grams;
      if (k.value != null && value != null) k.value += value;
      byKind.set(a.kind, k);

      const mKey = a.member_id ?? "none";
      const m = byMember.get(mKey) || {
        memberId: a.member_id,
        name: a.member_name ?? null,
        grams: 0,
        value: headline ? 0 : null,
      };
      m.grams += grams;
      if (m.value != null && value != null) m.value += value;
      byMember.set(mKey, m);
    }

    res.json({
      totalGrams,
      totalValue,
      ratePerGram: headline?.rate ?? null,
      rateAt: headline?.at ?? null,
      byKind: [...byKind.values()],
      byMember: [...byMember.values()],
    });
  })
);

r.get(
  "/history",
  ah(async (req, res) => {
    const [{ rows: rates }, { rows: totals }] = await Promise.all([
      pool.query(
        "SELECT rate_per_gram, fetched_at FROM gold_rates WHERE karat=22 ORDER BY fetched_at DESC LIMIT 90",
        [] // history reads only cached rows — never the provider
      ),
      pool.query("SELECT COALESCE(SUM(weight_grams),0) AS grams FROM assets WHERE user_id=$1", [
        req.user.id,
      ]),
    ]);
    const totalGrams = Number(totals[0].grams);
    const history = rates.reverse().map((row) => ({
      at: row.fetched_at,
      ratePerGram: Number(row.rate_per_gram),
      totalValue: Math.round(totalGrams * Number(row.rate_per_gram)),
    }));
    res.json({ history });
  })
);

export default r;
