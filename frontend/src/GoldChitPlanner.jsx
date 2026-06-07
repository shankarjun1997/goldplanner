import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { exportCSV, exportPDF } from "./export.js";

// ---------- helpers ----------
const fmt = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n || 0));

const nowYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}
function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Server rows use snake_case; the UI works in camelCase.
function normalize(row) {
  return {
    id: row.id,
    name: row.name,
    karat: Number(row.karat),
    monthlyAmount: Number(row.monthly_amount),
    months: Number(row.months),
    bonusInstallments: Number(row.bonus_installments),
    startYm: row.start_ym,
    rate: Number(row.current_rate || 0),
    payments: row.payments || {},
  };
}

// Classic gold-chit math. Pure — also used by the exporters.
export function derive(plan) {
  const schedule = Array.from({ length: plan.months }, (_, i) => {
    const key = addMonths(plan.startYm, i);
    return { index: i + 1, key, label: monthLabel(key) };
  });
  const totalContribution = plan.monthlyAmount * plan.months;
  const bonusAmount = plan.monthlyAmount * plan.bonusInstallments;
  const maturityValue = totalContribution + bonusAmount;
  const paidRates = schedule.map((s) => plan.payments?.[s.key]?.rate).filter((x) => x > 0);
  const rate = paidRates.length ? paidRates[paidRates.length - 1] : plan.rate;
  const gramsAtMaturity = rate ? maturityValue / rate : 0;
  return { schedule, totalContribution, bonusAmount, maturityValue, gramsAtMaturity, rate };
}

// ---------- auth screen ----------
export function AuthScreen({ login, signup }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      mode === "login" ? await login(email, pw) : await signup(email, pw);
    } catch (ex) {
      setErr(ex.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gc-auth">
      <form className="gc-auth-card" onSubmit={submit}>
        <div className="gc-brand big">◆ GoldPlanner</div>
        <p className="gc-auth-sub">Plan your gold chit savings, month by month.</p>
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input placeholder="Password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {err && <div className="gc-err">{err}</div>}
        <button className="gc-btn-primary" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        <button type="button" className="gc-link" onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}>
          {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
        </button>
      </form>
    </div>
  );
}

// ---------- planner (the Plans tab) ----------
export default function GoldChitPlanner({ user, setShowUpgrade }) {
  const [plans, setPlans] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [form, setForm] = useState(null); // the editable plan
  const [saving, setSaving] = useState(false);

  const reloadList = async () => {
    const { plans } = await api.listPlans();
    return plans.map(normalize);
  };

  useEffect(() => {
    (async () => {
      const norm = await reloadList();
      setPlans(norm);
      if (norm.length) {
        setActiveId(norm[0].id);
        setForm(norm[0]);
      }
    })();
  }, []);

  const plan = form;
  const karat = plan?.karat || 22;
  const setRate = (v) => setForm((f) => ({ ...f, rate: v }));
  const d = useMemo(() => (plan ? derive(plan) : null), [plan]);

  const selectPlan = (id) => {
    const p = plans.find((x) => x.id === id);
    setActiveId(id);
    setForm(p);
  };

  const newPlan = () => {
    setActiveId(null);
    setForm({
      id: null,
      name: "My Gold Chit",
      karat: 22,
      monthlyAmount: 5000,
      months: 11,
      bonusInstallments: 1,
      startYm: nowYm(),
      rate: 0,
      payments: {},
    });
  };

  const save = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const payload = {
        name: plan.name,
        karat: plan.karat,
        monthlyAmount: plan.monthlyAmount,
        months: plan.months,
        bonusInstallments: plan.bonusInstallments,
        startYm: plan.startYm,
        currentRate: plan.rate,
        payments: plan.payments,
      };
      if (plan.id == null) {
        const { plan: created } = await api.createPlan(payload);
        const n = normalize(created);
        setForm(n);
        setActiveId(n.id);
      } else {
        const { plan: updated } = await api.updatePlan(plan.id, payload);
        setForm(normalize(updated));
      }
      setPlans(await reloadList());
    } catch (e) {
      if (e.status === 402) setShowUpgrade(true);
      else alert(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = (key) => {
    setForm((f) => {
      const cur = f.payments[key];
      const next = cur?.paid ? { ...cur, paid: false } : { paid: true, rate: f.rate || 0 };
      return { ...f, payments: { ...f.payments, [key]: next } };
    });
  };

  // "Use live rate" — premium only.
  const useLiveRate = async () => {
    if (!user.is_premium) return setShowUpgrade(true);
    try {
      const { ratePerGram } = await api.goldRate(karat);
      setRate(ratePerGram);
    } catch (e) {
      if (e.status === 402) setShowUpgrade(true);
      else alert("Rate unavailable");
    }
  };

  const onExport = (kind) => {
    if (!user.is_premium) return setShowUpgrade(true);
    if (!plan) return;
    kind === "pdf" ? exportPDF(plan, derive(plan)) : exportCSV(plan, derive(plan));
  };

  return (
    <div className="gc-main">
        <aside className="gc-side">
          <div className="gc-side-head">
            <span>Your plans</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="gc-btn-ghost" onClick={() => onExport("pdf")} title="Export PDF">⤓ PDF</button>
              <button className="gc-btn-ghost" onClick={() => onExport("csv")} title="Export CSV">≡ CSV</button>
              <button className="gc-btn-ghost" onClick={newPlan}>+ New</button>
            </span>
          </div>
          {plans.map((p) => (
            <button
              key={p.id}
              className={"gc-plan-item" + (p.id === activeId ? " active" : "")}
              onClick={() => selectPlan(p.id)}
            >
              <div className="gc-plan-name">{p.name}</div>
              <div className="gc-plan-sub">
                {p.karat}K · {fmt(p.monthlyAmount)}/mo · {p.months}m
              </div>
            </button>
          ))}
          {!plans.length && <div className="gc-empty">No plans yet — create one.</div>}
        </aside>

        <main className="gc-content">
          {!plan && <div className="gc-card gc-empty-card">Select or create a plan to begin.</div>}

          {plan && (
            <>
              <Setup plan={plan} karat={karat} setForm={setForm} useLiveRate={useLiveRate} saving={saving} save={save} />

              <section className="gc-summary">
                <div className="gc-stat"><span>Total contribution</span><b>{fmt(d.totalContribution)}</b></div>
                <div className="gc-stat"><span>Bonus</span><b>{fmt(d.bonusAmount)}</b></div>
                <div className="gc-stat hl"><span>Maturity value</span><b>{fmt(d.maturityValue)}</b></div>
                <div className="gc-stat"><span>Gold at maturity</span><b>{d.gramsAtMaturity.toFixed(2)} g</b></div>
              </section>

              <section className="gc-card">
                <div className="gc-card-head">
                  <h2 className="gc-h2">Payment schedule</h2>
                  {plan.id != null && (
                    <button className="gc-btn-ghost" onClick={save} disabled={saving}>
                      {saving ? "Saving…" : "Save payments"}
                    </button>
                  )}
                </div>
                <div className="gc-table-wrap">
                  <table className="gc-table">
                    <thead>
                      <tr><th>#</th><th>Month</th><th>Installment</th><th>Rate/g</th><th>Grams</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {d.schedule.map((s) => {
                        const p = plan.payments[s.key];
                        const g = p?.paid && p.rate > 0 ? (plan.monthlyAmount / p.rate).toFixed(2) : "—";
                        return (
                          <tr key={s.key} className={p?.paid ? "paid" : ""}>
                            <td>{s.index}</td>
                            <td>{s.label}</td>
                            <td>{fmt(plan.monthlyAmount)}</td>
                            <td>{p?.rate ? fmt(p.rate) : "—"}</td>
                            <td>{g}</td>
                            <td>
                              <button className={"gc-toggle" + (p?.paid ? " on" : "")} onClick={() => togglePaid(s.key)}>
                                {p?.paid ? "Paid" : "Mark paid"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
    </div>
  );
}

// ---------- setup card ----------
function Setup({ plan, karat, setForm, useLiveRate, saving, save }) {
  const set = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  return (
    <section className="gc-card">
      <h2 className="gc-h2">Setup</h2>
      <div className="gc-grid">
        <label className="gc-field"><span>Plan name</span>
          <input value={plan.name} onChange={set("name")} /></label>
        <label className="gc-field"><span>Monthly installment (₹)</span>
          <input type="number" value={plan.monthlyAmount} onChange={set("monthlyAmount")} /></label>
        <label className="gc-field"><span>Months</span>
          <input type="number" value={plan.months} onChange={set("months")} /></label>
        <label className="gc-field"><span>Bonus installments</span>
          <input type="number" step="0.1" value={plan.bonusInstallments} onChange={set("bonusInstallments")} /></label>
        <label className="gc-field"><span>Purity</span>
          <select value={plan.karat} onChange={set("karat")}>
            <option value={22}>22K</option>
            <option value={24}>24K</option>
          </select></label>
        <label className="gc-field"><span>Start month</span>
          <input type="month" value={plan.startYm} onChange={set("startYm")} /></label>
        <label className="gc-field"><span>Gold rate (₹/g)</span>
          <input type="number" value={plan.rate} onChange={set("rate")} />
          <button type="button" className="gc-btn-ghost" onClick={useLiveRate} style={{ marginTop: 6 }}>
            ↻ Use live {karat}K rate
          </button></label>
      </div>
      <button className="gc-btn-primary" disabled={saving} onClick={save}>
        {saving ? "Saving…" : plan.id == null ? "Create plan" : "Save changes"}
      </button>
    </section>
  );
}
