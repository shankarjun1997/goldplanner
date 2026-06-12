import React, { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { api, unwrapList } from "./api.js";
import { fmt, fmtGrams, fmtDate, kindEmoji, kindLabel, occasionEmoji } from "./wealth.js";

// progressPct arrives as a 0–100 number; clamp defensively.
export const normPct = (p) => Math.max(0, Math.min(100, Number(p || 0)));

export default function Dashboard({ onGoTo }) {
  const [net, setNet] = useState(null);
  const [history, setHistory] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [goals, setGoals] = useState([]);
  const [counts, setCounts] = useState({ members: 0, plans: 0, assets: 0 });
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("gp_onboard") === "done");

  useEffect(() => {
    (async () => {
      const [n, h, f, g, m, p, a] = await Promise.allSettled([
        api.networth(),
        api.networthHistory(),
        api.festivals(),
        api.listGoals(),
        api.listMembers(),
        api.listPlans(),
        api.listAssets(),
      ]);
      if (n.status === "fulfilled") setNet(n.value);
      if (h.status === "fulfilled") setHistory(unwrapList(h.value, "history"));
      if (f.status === "fulfilled") setFestivals(unwrapList(f.value, "festivals"));
      if (g.status === "fulfilled") setGoals(unwrapList(g.value, "goals"));
      setCounts({
        members: m.status === "fulfilled" ? unwrapList(m.value, "members").length : 0,
        plans: p.status === "fulfilled" ? unwrapList(p.value, "plans").length : 0,
        assets: a.status === "fulfilled" ? unwrapList(a.value, "assets").length : 0,
      });
      setLoading(false);
    })();
  }, []);

  const steps = [
    { id: "member", label: "Add yourself", done: counts.members > 0, tab: "vault" },
    { id: "plan", label: "Create a gold plan", done: counts.plans > 0, tab: "plans" },
    { id: "asset", label: "Add your first asset", done: counts.assets > 0, tab: "vault" },
    { id: "goal", label: "Set a savings goal", done: goals.length > 0, tab: "goals" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const strength = Math.round((doneCount / steps.length) * 100);
  const showOnboard = !dismissed && doneCount < steps.length;
  const dismiss = () => { localStorage.setItem("gp_onboard", "done"); setDismissed(true); };

  const nextGoals = useMemo(
    () =>
      [...goals]
        .filter((g) => g.target_date)
        .sort((a, b) => new Date(a.target_date) - new Date(b.target_date))
        .slice(0, 2),
    [goals]
  );

  if (loading) return <div className="gc-center" style={{ minHeight: "40vh" }}>Loading…</div>;

  return (
    <div className="gc-content" style={{ marginTop: 20 }}>
      {/* ----- onboarding journey ----- */}
      {showOnboard && (
        <section className="gc-card gc-onboard">
          <div className="gc-onboard-head">
            <div>
              <div className="gc-hero-label">Your Gold Journey</div>
              <div className="gc-onboard-strength">Profile strength <b>{strength}%</b></div>
            </div>
            <button className="gc-mini-btn" title="Dismiss" onClick={dismiss}>✕</button>
          </div>
          <div className="gc-progress" style={{ margin: "12px 0 14px" }}>
            <div className="gc-progress-fill" style={{ width: strength + "%" }} />
          </div>
          <div className="gc-onboard-steps">
            {steps.map((s) => (
              <button
                key={s.id}
                className={"gc-step" + (s.done ? " done" : "")}
                onClick={() => !s.done && onGoTo?.(s.tab)}
                disabled={s.done}
              >
                <span className="gc-step-check">{s.done ? "✓" : "○"}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ----- net worth hero ----- */}
      <section className="gc-card gc-hero">
        <div className="gc-hero-label">Gold Net Worth</div>
        <div className="gc-hero-row">
          <div className="gc-hero-grams">{fmtGrams(net?.totalGrams)}</div>
          <div className="gc-hero-value">{fmt(net?.totalValue)}</div>
        </div>
        {net?.ratePerGram ? (
          <div className="gc-hero-rate">
            @ {fmt(net.ratePerGram)}/g{net.rateAt ? ` · as of ${fmtDate(net.rateAt)}` : ""}
          </div>
        ) : null}
        <div className="gc-chip-row">
          {(net?.byKind || []).map((k) => (
            <span key={k.kind} className="gc-chip">
              {kindEmoji(k.kind)} {kindLabel(k.kind)} · {fmtGrams(k.grams)} · {fmt(k.value)}
            </span>
          ))}
          {!(net?.byKind || []).length && (
            <span className="gc-chip dim">
              No assets yet — add them in the <button className="gc-link" style={{ padding: 0 }} onClick={() => onGoTo?.("vault")}>Vault</button>
            </span>
          )}
        </div>
      </section>

      {/* ----- growth chart ----- */}
      <section className="gc-card">
        <h2 className="gc-h2"><TrendingUp size={15} style={{ verticalAlign: -2 }} /> Growth</h2>
        <GrowthChart points={history} onGoTo={onGoTo} hasAssets={counts.assets > 0} />
      </section>

      <div className="gc-dash-grid">
        {/* ----- by member ----- */}
        <section className="gc-card">
          <h2 className="gc-h2">By member</h2>
          {(net?.byMember || []).map((m) => (
            <div key={m.memberId ?? "none"} className="gc-mini-row">
              <span className="gc-mini-name">{m.name || "Unassigned"}</span>
              <span className="gc-mini-grams">{fmtGrams(m.grams)}</span>
              <b className="gc-mini-value">{fmt(m.value)}</b>
            </div>
          ))}
          {!(net?.byMember || []).length && <div className="gc-empty">Add family members in the Vault.</div>}
        </section>

        {/* ----- upcoming ----- */}
        <section className="gc-card">
          <h2 className="gc-h2">Upcoming</h2>
          {festivals.slice(0, 2).map((f) => (
            <div key={f.name + f.date} className="gc-mini-row">
              <span className="gc-mini-name">🪔 {f.name}</span>
              <span className="gc-mini-grams">{fmtDate(f.date)}</span>
              <span className="gc-badge">{f.daysAway} days</span>
            </div>
          ))}
          {nextGoals.map((g) => (
            <div key={g.id} className="gc-mini-goal">
              <div className="gc-mini-row" style={{ border: "none", padding: "0 0 6px" }}>
                <span className="gc-mini-name">{occasionEmoji(g.occasion)} {g.title}</span>
                <span className="gc-mini-grams">{fmtDate(g.target_date)}</span>
                <b className="gc-mini-value">{Math.round(normPct(g.progressPct))}%</b>
              </div>
              <div className="gc-progress"><div className="gc-progress-fill" style={{ width: normPct(g.progressPct) + "%" }} /></div>
            </div>
          ))}
          {!festivals.length && !nextGoals.length && (
            <div className="gc-empty">No upcoming festivals or goals yet.</div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- hand-rolled SVG line chart ----------
function GrowthChart({ points, onGoTo, hasAssets }) {
  const data = (points || [])
    .filter((p) => p && p.totalValue != null)
    .map((p) => ({ at: p.at, v: Number(p.totalValue) }));

  if (data.length < 2) {
    return (
      <div className="gc-chart-empty">
        <TrendingUp size={24} style={{ opacity: 0.5 }} />
        <div>Your wealth growth chart appears here as gold rates update over time.</div>
        {!hasAssets && (
          <button className="gc-btn-ghost" onClick={() => onGoTo?.("vault")}>Add your first asset →</button>
        )}
      </div>
    );
  }

  const W = 640, H = 180, PAD = { t: 12, r: 12, b: 22, l: 12 };
  const vs = data.map((d) => d.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  if (min === max) { min -= 1; max += 1; }
  const x = (i) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.v).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `${PAD.l},${H - PAD.b} ${line} ${W - PAD.r},${H - PAD.b}`;
  const last = data[data.length - 1];

  return (
    <div className="gc-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Net worth growth chart">
        <defs>
          <linearGradient id="gcArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2c871" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#e2c871" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="rgba(201,168,76,.18)" strokeWidth="1" />
        <line x1={PAD.l} y1={PAD.t} x2={W - PAD.r} y2={PAD.t} stroke="rgba(201,168,76,.08)" strokeWidth="1" strokeDasharray="3 4" />
        <polygon points={area} fill="url(#gcArea)" />
        <polyline points={line} fill="none" stroke="#e2c871" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(data.length - 1)} cy={y(last.v)} r="3.5" fill="#f2e2a8" />
      </svg>
      <div className="gc-chart-meta">
        <span>{fmtDate(data[0].at)}</span>
        <span className="gc-chart-range">{fmt(min)} – {fmt(max)}</span>
        <span>{fmtDate(last.at)} · <b style={{ color: "var(--gold)" }}>{fmt(last.v)}</b></span>
      </div>
    </div>
  );
}
