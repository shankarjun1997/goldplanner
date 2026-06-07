import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();
const FREE_LIMIT = Number(process.env.FREE_PLAN_LIMIT || 1);

r.use(auth);

r.get(
  "/",
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM plans WHERE user_id=$1 ORDER BY created_at",
      [req.user.id]
    );
    res.json({ plans: rows });
  })
);

r.post(
  "/",
  ah(async (req, res) => {
    // Freemium gate: free users capped at FREE_LIMIT plans; premium skips the check.
    const me = (await pool.query("SELECT is_premium FROM users WHERE id=$1", [req.user.id])).rows[0];
    if (!me?.is_premium) {
      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM plans WHERE user_id=$1",
        [req.user.id]
      );
      if (rows[0].n >= FREE_LIMIT) return res.status(402).json({ error: "upgrade_required" });
    }

    const {
      name,
      karat = 22,
      monthlyAmount,
      months = 11,
      bonusInstallments = 1,
      startYm,
      currentRate = 0,
    } = req.body || {};
    if (!name || !monthlyAmount || !startYm)
      return res.status(400).json({ error: "name, monthlyAmount, startYm required" });

    const { rows } = await pool.query(
      `INSERT INTO plans (user_id, name, karat, monthly_amount, months, bonus_installments, start_ym, current_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, name, karat, monthlyAmount, months, bonusInstallments, startYm, currentRate]
    );
    res.json({ plan: rows[0] });
  })
);

r.put(
  "/:id",
  ah(async (req, res) => {
    const { name, karat, monthlyAmount, months, bonusInstallments, startYm, currentRate, payments } =
      req.body || {};
    const { rows } = await pool.query(
      `UPDATE plans SET
         name=COALESCE($2,name),
         karat=COALESCE($3,karat),
         monthly_amount=COALESCE($4,monthly_amount),
         months=COALESCE($5,months),
         bonus_installments=COALESCE($6,bonus_installments),
         start_ym=COALESCE($7,start_ym),
         current_rate=COALESCE($8,current_rate),
         payments=COALESCE($9,payments)
       WHERE id=$1 AND user_id=$10 RETURNING *`,
      [
        req.params.id,
        name,
        karat,
        monthlyAmount,
        months,
        bonusInstallments,
        startYm,
        currentRate,
        payments ? JSON.stringify(payments) : null,
        req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ plan: rows[0] });
  })
);

r.delete(
  "/:id",
  ah(async (req, res) => {
    await pool.query("DELETE FROM plans WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ ok: true });
  })
);

export default r;
