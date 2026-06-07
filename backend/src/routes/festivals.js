import { Router } from "express";
import { auth } from "../middleware.js";

const r = Router();

// Static lunar-calendar dates through 2035 — no DB, no provider.
const FESTIVALS = {
  "Akshaya Tritiya": [
    "2026-04-19", "2027-05-09", "2028-04-28", "2029-04-16", "2030-05-06",
    "2031-04-25", "2032-05-12", "2033-05-02", "2034-04-21", "2035-05-10",
  ],
  Dhanteras: [
    "2026-11-06", "2027-10-27", "2028-10-15", "2029-11-03", "2030-10-24",
    "2031-11-11", "2032-10-30", "2033-10-20", "2034-11-07", "2035-10-28",
  ],
};

r.get("/", auth, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todayMs = new Date(today + "T00:00:00Z").getTime();
  const out = Object.entries(FESTIVALS)
    .flatMap(([name, dates]) => dates.map((date) => ({ name, date })))
    .filter((f) => f.date >= today)
    .map((f) => ({
      ...f,
      daysAway: Math.round((new Date(f.date + "T00:00:00Z").getTime() - todayMs) / 86_400_000),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  res.json(out);
});

export default r;
