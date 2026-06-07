import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import planRoutes from "./routes/plans.js";
import billingRoutes, { webhookHandler } from "./routes/billing.js";
import goldRoutes from "./routes/gold.js";
import memberRoutes from "./routes/members.js";
import assetRoutes from "./routes/assets.js";
import goalRoutes from "./routes/goals.js";
import networthRoutes from "./routes/networth.js";
import festivalRoutes from "./routes/festivals.js";
import loanRoutes from "./routes/loans.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

// Stripe webhook needs the raw body for signature verification — mount BEFORE express.json().
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/gold", goldRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/networth", networthRoutes);
app.use("/api/festivals", festivalRoutes);
app.use("/api/loans", loanRoutes);

// Centralised error handler.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API on :${port}`));
