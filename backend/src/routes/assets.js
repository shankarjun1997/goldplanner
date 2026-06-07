import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();
const FREE_LIMIT = Number(process.env.FREE_ASSET_LIMIT || 2);
const KINDS = ["coin", "jewellery", "bar", "digital", "chit_maturity"];

r.use(auth);

// Latest cached rate per karat — NEVER calls the provider (gold.js owns that).
async function latestRate(karat) {
  const { rows } = await pool.query(
    "SELECT rate_per_gram FROM gold_rates WHERE karat=$1 ORDER BY fetched_at DESC LIMIT 1",
    [karat]
  );
  return rows[0] ? Number(rows[0].rate_per_gram) : null;
}

async function ownsMember(userId, memberId) {
  if (memberId == null) return true;
  const { rows } = await pool.query("SELECT 1 FROM family_members WHERE id=$1 AND user_id=$2", [
    memberId,
    userId,
  ]);
  return !!rows[0];
}

r.get(
  "/",
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM assets WHERE user_id=$1 ORDER BY created_at",
      [req.user.id]
    );
    const [rate22, rate24] = await Promise.all([latestRate(22), latestRate(24)]);
    const assets = rows.map((a) => {
      const rate = a.karat === 24 ? rate24 : rate22;
      return {
        ...a,
        currentValue: rate != null ? Math.round(Number(a.weight_grams) * rate) : null,
      };
    });
    res.json({ assets });
  })
);

r.post(
  "/",
  ah(async (req, res) => {
    const me = (await pool.query("SELECT is_premium FROM users WHERE id=$1", [req.user.id])).rows[0];
    if (!me?.is_premium) {
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM assets WHERE user_id=$1",
        [req.user.id]
      );
      if (rows[0].n >= FREE_LIMIT) return res.status(402).json({ error: "upgrade_required" });
    }

    const b = req.body || {};
    const memberId = b.member_id ?? b.memberId ?? null;
    const nomineeId = b.nominee_id ?? b.nomineeId ?? null;
    const weightGrams = b.weight_grams ?? b.weightGrams;
    const purchaseDate = b.purchase_date ?? b.purchaseDate ?? null;
    const purchasePrice = b.purchase_price ?? b.purchasePrice ?? null;
    const { kind, description, karat = 22 } = b;

    if (!kind || !description || !weightGrams)
      return res.status(400).json({ error: "kind, description, weight_grams required" });
    if (!KINDS.includes(kind)) return res.status(400).json({ error: "invalid kind" });
    if (![22, 24].includes(Number(karat))) return res.status(400).json({ error: "invalid karat" });
    if (!(await ownsMember(req.user.id, memberId)) || !(await ownsMember(req.user.id, nomineeId)))
      return res.status(400).json({ error: "invalid member" });

    const { rows } = await pool.query(
      `INSERT INTO assets (user_id, member_id, kind, description, weight_grams, karat, purchase_date, purchase_price, nominee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, memberId, kind, description, weightGrams, karat, purchaseDate, purchasePrice, nomineeId]
    );
    res.json({ asset: rows[0] });
  })
);

r.put(
  "/:id",
  ah(async (req, res) => {
    const b = req.body || {};
    const memberId = b.member_id ?? b.memberId;
    const nomineeId = b.nominee_id ?? b.nomineeId;
    const weightGrams = b.weight_grams ?? b.weightGrams;
    const purchaseDate = b.purchase_date ?? b.purchaseDate;
    const purchasePrice = b.purchase_price ?? b.purchasePrice;
    const { kind, description, karat } = b;

    if (kind != null && !KINDS.includes(kind)) return res.status(400).json({ error: "invalid kind" });
    if (karat != null && ![22, 24].includes(Number(karat)))
      return res.status(400).json({ error: "invalid karat" });
    if (!(await ownsMember(req.user.id, memberId)) || !(await ownsMember(req.user.id, nomineeId)))
      return res.status(400).json({ error: "invalid member" });

    const { rows } = await pool.query(
      `UPDATE assets SET
         member_id=COALESCE($2,member_id),
         kind=COALESCE($3,kind),
         description=COALESCE($4,description),
         weight_grams=COALESCE($5,weight_grams),
         karat=COALESCE($6,karat),
         purchase_date=COALESCE($7,purchase_date),
         purchase_price=COALESCE($8,purchase_price),
         nominee_id=COALESCE($9,nominee_id)
       WHERE id=$1 AND user_id=$10 RETURNING *`,
      [
        req.params.id,
        memberId ?? null,
        kind,
        description,
        weightGrams ?? null,
        karat,
        purchaseDate ?? null,
        purchasePrice ?? null,
        nomineeId ?? null,
        req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ asset: rows[0] });
  })
);

r.delete(
  "/:id",
  ah(async (req, res) => {
    await pool.query("DELETE FROM assets WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  })
);

export default r;
