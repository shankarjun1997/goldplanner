import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();
const FREE_LIMIT = Number(process.env.FREE_GOAL_LIMIT || 1);
const OCCASIONS = [
  "wedding",
  "birthday",
  "akshaya_tritiya",
  "dhanteras",
  "naming",
  "housewarming",
  "baby_shower",
  "retirement",
  "custom",
];
const RECURRING = [null, "monthly", "yearly"];

r.use(auth);

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

// Whole months from today to target, rounded up, never less than 1.
function monthsLeft(targetDate) {
  const now = new Date();
  const target = new Date(targetDate);
  let months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  if (target.getDate() > now.getDate()) months += 1;
  return Math.max(1, months);
}

r.get(
  "/",
  ah(async (req, res) => {
    const [{ rows: goals }, { rows: gramsByMember }, rate22] = await Promise.all([
      pool.query("SELECT * FROM goals WHERE user_id=$1 ORDER BY target_date, created_at", [req.user.id]),
      pool.query(
        "SELECT member_id, SUM(weight_grams) AS grams FROM assets WHERE user_id=$1 GROUP BY member_id",
        [req.user.id]
      ),
      latestRate(22),
    ]);
    const gramsFor = new Map(gramsByMember.map((g) => [g.member_id, Number(g.grams)]));

    const out = goals.map((g) => {
      const targetGrams = g.target_grams != null ? Number(g.target_grams) : null;
      const targetAmount = g.target_amount != null ? Number(g.target_amount) : null;
      const ownedGrams = g.member_id != null ? gramsFor.get(g.member_id) || 0 : 0;

      const neededGrams = targetGrams != null ? Math.max(0, targetGrams - ownedGrams) : null;
      let neededAmount = null;
      if (neededGrams != null && rate22 != null) neededAmount = Math.round(neededGrams * rate22);
      else if (neededGrams == null && targetAmount != null) neededAmount = Math.round(targetAmount);

      const months = monthsLeft(g.target_date);
      const monthlySaving = neededAmount != null ? Math.round(neededAmount / months) : null;

      let progressPct = 0;
      if (targetGrams != null && targetGrams > 0)
        progressPct = Math.min(100, Math.round((ownedGrams / targetGrams) * 100));
      else if (targetAmount != null && targetAmount > 0 && rate22 != null)
        progressPct = Math.min(100, Math.round(((ownedGrams * rate22) / targetAmount) * 100));

      return {
        ...g,
        ownedGrams,
        neededGrams,
        neededAmount,
        monthsLeft: months,
        monthlySaving,
        progressPct,
      };
    });
    res.json({ goals: out });
  })
);

r.post(
  "/",
  ah(async (req, res) => {
    const me = (await pool.query("SELECT is_premium FROM users WHERE id=$1", [req.user.id])).rows[0];
    if (!me?.is_premium) {
      const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM goals WHERE user_id=$1", [
        req.user.id,
      ]);
      if (rows[0].n >= FREE_LIMIT) return res.status(402).json({ error: "upgrade_required" });
    }

    const b = req.body || {};
    const memberId = b.member_id ?? b.memberId ?? null;
    const targetGrams = b.target_grams ?? b.targetGrams ?? null;
    const targetAmount = b.target_amount ?? b.targetAmount ?? null;
    const targetDate = b.target_date ?? b.targetDate;
    const { occasion, title, recurring = null } = b;

    if (!occasion || !title || !targetDate)
      return res.status(400).json({ error: "occasion, title, target_date required" });
    if (!OCCASIONS.includes(occasion)) return res.status(400).json({ error: "invalid occasion" });
    if (targetGrams == null && targetAmount == null)
      return res.status(400).json({ error: "target_grams or target_amount required" });
    if (!RECURRING.includes(recurring)) return res.status(400).json({ error: "invalid recurring" });
    if (!(await ownsMember(req.user.id, memberId)))
      return res.status(400).json({ error: "invalid member" });

    const { rows } = await pool.query(
      `INSERT INTO goals (user_id, member_id, occasion, title, target_grams, target_amount, target_date, recurring)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, memberId, occasion, title, targetGrams, targetAmount, targetDate, recurring]
    );
    res.json({ goal: rows[0] });
  })
);

r.put(
  "/:id",
  ah(async (req, res) => {
    const b = req.body || {};
    const memberId = b.member_id ?? b.memberId;
    const targetGrams = b.target_grams ?? b.targetGrams;
    const targetAmount = b.target_amount ?? b.targetAmount;
    const targetDate = b.target_date ?? b.targetDate;
    const { occasion, title, recurring } = b;

    if (occasion != null && !OCCASIONS.includes(occasion))
      return res.status(400).json({ error: "invalid occasion" });
    if (recurring !== undefined && !RECURRING.includes(recurring))
      return res.status(400).json({ error: "invalid recurring" });
    if (!(await ownsMember(req.user.id, memberId)))
      return res.status(400).json({ error: "invalid member" });

    const { rows } = await pool.query(
      `UPDATE goals SET
         member_id=COALESCE($2,member_id),
         occasion=COALESCE($3,occasion),
         title=COALESCE($4,title),
         target_grams=COALESCE($5,target_grams),
         target_amount=COALESCE($6,target_amount),
         target_date=COALESCE($7,target_date),
         recurring=COALESCE($8,recurring)
       WHERE id=$1 AND user_id=$9 RETURNING *`,
      [
        req.params.id,
        memberId ?? null,
        occasion,
        title,
        targetGrams ?? null,
        targetAmount ?? null,
        targetDate ?? null,
        recurring ?? null,
        req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ goal: rows[0] });
  })
);

r.delete(
  "/:id",
  ah(async (req, res) => {
    await pool.query("DELETE FROM goals WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  })
);

export default r;
