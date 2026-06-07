import { Router } from "express";
import { auth, ah } from "../middleware.js";
import { pool } from "../db.js";

const r = Router();
const RELATIONS = ["self", "wife", "husband", "daughter", "son", "mother", "father", "other"];

r.use(auth);

r.get(
  "/",
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM family_members WHERE user_id=$1 ORDER BY created_at",
      [req.user.id]
    );
    res.json({ members: rows });
  })
);

r.post(
  "/",
  ah(async (req, res) => {
    const b = req.body || {};
    const { name, relation } = b;
    const birthYear = b.birth_year ?? b.birthYear ?? null;
    if (!name || !relation) return res.status(400).json({ error: "name, relation required" });
    if (!RELATIONS.includes(relation)) return res.status(400).json({ error: "invalid relation" });

    const { rows } = await pool.query(
      "INSERT INTO family_members (user_id, name, relation, birth_year) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.user.id, name, relation, birthYear]
    );
    res.json({ member: rows[0] });
  })
);

r.put(
  "/:id",
  ah(async (req, res) => {
    const b = req.body || {};
    const { name, relation } = b;
    const birthYear = b.birth_year ?? b.birthYear ?? null;
    if (relation != null && !RELATIONS.includes(relation))
      return res.status(400).json({ error: "invalid relation" });

    const { rows } = await pool.query(
      `UPDATE family_members SET
         name=COALESCE($2,name),
         relation=COALESCE($3,relation),
         birth_year=COALESCE($4,birth_year)
       WHERE id=$1 AND user_id=$5 RETURNING *`,
      [req.params.id, name, relation, birthYear, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ member: rows[0] });
  })
);

r.delete(
  "/:id",
  ah(async (req, res) => {
    await pool.query("DELETE FROM family_members WHERE id=$1 AND user_id=$2", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  })
);

export default r;
