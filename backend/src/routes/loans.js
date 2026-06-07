import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();
const DAY_MS = 86_400_000;

r.use(auth);

r.get(
  "/",
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM gold_loans WHERE user_id=$1 ORDER BY due_date, created_at",
      [req.user.id]
    );
    const now = Date.now();
    const loans = rows.map((l) => {
      const yearsElapsed = Math.max(0, (now - new Date(l.created_at).getTime()) / (365.25 * DAY_MS));
      return {
        ...l,
        daysUntilDue: Math.ceil((new Date(l.due_date).getTime() - now) / DAY_MS),
        accruedInterest: Math.round((Number(l.principal) * Number(l.interest_pct) * yearsElapsed) / 100),
      };
    });
    res.json({ loans });
  })
);

r.post(
  "/",
  ah(async (req, res) => {
    const b = req.body || {};
    const pledgedGrams = b.pledged_grams ?? b.pledgedGrams;
    const interestPct = b.interest_pct ?? b.interestPct;
    const dueDate = b.due_date ?? b.dueDate;
    const { lender, principal } = b;

    if (!lender || !pledgedGrams || !principal || interestPct == null || !dueDate)
      return res
        .status(400)
        .json({ error: "lender, pledged_grams, principal, interest_pct, due_date required" });

    const { rows } = await pool.query(
      `INSERT INTO gold_loans (user_id, lender, pledged_grams, principal, interest_pct, due_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, lender, pledgedGrams, principal, interestPct, dueDate]
    );
    res.json({ loan: rows[0] });
  })
);

r.put(
  "/:id",
  ah(async (req, res) => {
    const b = req.body || {};
    const pledgedGrams = b.pledged_grams ?? b.pledgedGrams;
    const interestPct = b.interest_pct ?? b.interestPct;
    const dueDate = b.due_date ?? b.dueDate;
    const { lender, principal, closed } = b;

    const { rows } = await pool.query(
      `UPDATE gold_loans SET
         lender=COALESCE($2,lender),
         pledged_grams=COALESCE($3,pledged_grams),
         principal=COALESCE($4,principal),
         interest_pct=COALESCE($5,interest_pct),
         due_date=COALESCE($6,due_date),
         closed=COALESCE($7,closed)
       WHERE id=$1 AND user_id=$8 RETURNING *`,
      [
        req.params.id,
        lender,
        pledgedGrams ?? null,
        principal,
        interestPct ?? null,
        dueDate ?? null,
        closed ?? null,
        req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ loan: rows[0] });
  })
);

r.delete(
  "/:id",
  ah(async (req, res) => {
    await pool.query("DELETE FROM gold_loans WHERE id=$1 AND user_id=$2", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  })
);

export default r;
