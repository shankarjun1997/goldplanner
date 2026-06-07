import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { auth, ah } from "../middleware.js";

const r = Router();

const sign = (u) =>
  jwt.sign({ sub: u.id, email: u.email }, process.env.JWT_SECRET, { expiresIn: "30d" });

r.post(
  "/signup",
  ah(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        "INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email, is_premium",
        [email.toLowerCase(), hash]
      );
      res.json({ token: sign(rows[0]), user: rows[0] });
    } catch (e) {
      if (e.code === "23505")
        return res.status(409).json({ error: "email already registered" });
      throw e;
    }
  })
);

r.post(
  "/login",
  ah(async (req, res) => {
    const { email, password } = req.body || {};
    const { rows } = await pool.query(
      "SELECT id, email, password_hash, is_premium FROM users WHERE email=$1",
      [(email || "").toLowerCase()]
    );
    const u = rows[0];
    if (!u || !(await bcrypt.compare(password || "", u.password_hash)))
      return res.status(401).json({ error: "invalid credentials" });
    res.json({ token: sign(u), user: { id: u.id, email: u.email, is_premium: u.is_premium } });
  })
);

r.get(
  "/me",
  auth,
  ah(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT id, email, is_premium FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "not found" });
    res.json({ user: rows[0] });
  })
);

export default r;
