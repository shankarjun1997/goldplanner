import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { exportCSV, exportPDF } from "./export.js";
import { nowYm, normalizePlan, derive } from "./chitMath.js";

// ---------- helpers ----------
const fmt = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n || 0));

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
    return plans.map(normalizePlan);
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

  // Auto-fill the live rate for brand-new plans (premium) so the summary isn't 0.
  useEffect(() => {
    if (!user?.is_premium || !form || form.id != null || form.rate > 0) return;
    let alive = true;
    (async () => {
      try {
        const { ratePerGram } = await api.goldRate(form.karat);
        if (alive) setForm((f) => (f && f.id == null && !(f.rate > 0) ? { ...f, rate: ratePerGram } : f));
      } catch { /* leave 0; user can type a rate */ }
    })();
    return () => { alive = false; };
  }, [form?.id, form?.karat, user]);

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
        const n = normalizePlan(created);
        setForm(n);
        setActiveId(n.id);
      } else {
        const { plan: updated } = await api.updatePlan(plan.id, payload);
        setForm(normalizePlan(updated));
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
      const next = cur?.paid ? { ...cur, paid: false } : { ...cur, paid: true, rate: cur?.rate || f.rate || 0 };
      return { ...f, payments: { ...f.payments, [key]: next } };
    });
  };

  // Log the actual rate paid / a note against one month (#4 — real chits are
  // tracked retroactively).
  const setPayment = (key, patch) => {
    setForm((f) => ({
      ...f,
      payments: { ...f.payments, [key]: { ...(f.payments[key] || {}), ...patch } },
    }));
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
                <div className="gc-stat"><span>Paid so far</span><b>{d.paidCount}/{plan.months} · {fmt(d.paidAmount)}</b></div>
                <div className="gc-stat"><span>Gold accumulated</span><b>{d.gramsAccumulated > 0 ? d.gramsAccumulated.toFixed(2) + " g" : "—"}</b></div>
                <div className="gc-stat"><span>Projected at maturity</span><b>{d.rate > 0 ? d.gramsProjected.toFixed(2) + " g" : "—"}</b></div>
              </section>

              {d.rate <= 0 && (
                <div className="gc-note">Set a gold rate (or use the live rate) to see grams at maturity.</div>
              )}

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
                      <tr><th>#</th><th>Month</th><th>Installment</th><th>Rate/g paid</th><th>Grams</th><th>Note</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => (
                        <tr key={r.key} className={r.paid ? "paid" : ""}>
                          <td>{r.index}</td>
                          <td>{r.label}</td>
                          <td>{fmt(plan.monthlyAmount)}</td>
                          <td>
                            {r.paid ? (
                              <input
                                type="number"
                                className="gc-cell-input"
                                value={plan.payments[r.key]?.rate || ""}
                                placeholder="₹/g"
                                onChange={(e) => setPayment(r.key, { rate: e.target.value === "" ? 0 : Number(e.target.value) })}
                              />
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{r.grams != null ? r.grams.toFixed(2) : "—"}</td>
                          <td>
                            {r.paid ? (
                              <input
                                className="gc-cell-input note"
                                value={plan.payments[r.key]?.note || ""}
                                placeholder="e.g. paid at GRT"
                                maxLength={120}
                                onChange={(e) => setPayment(r.key, { note: e.target.value })}
                              />
                            ) : (
                              ""
                            )}
                          </td>
                          <td>
                            <button className={"gc-toggle" + (r.paid ? " on" : "")} onClick={() => togglePaid(r.key)}>
                              {r.paid ? "Paid" : "Mark paid"}
                            </button>
                          </td>
                        </tr>
                      ))}
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
  const rateInvalid = !(plan.rate > 0);
  return (
    <section className="gc-card">
      <h2 className="gc-h2">Setup</h2>
      <div className="gc-grid">
        <label className="gc-field"><span>Plan name</span>
          <input value={plan.name} onChange={set("name")} onFocus={(e) => e.target.select()} /></label>
        <label className="gc-field"><span>Monthly installment (₹)</span>
          <input type="number" value={plan.monthlyAmount} onChange={set("monthlyAmount")} /></label>
        <label className="gc-field"><span>Months</span>
          <input type="number" value={plan.months} onChange={set("months")} /></label>
        <label className="gc-field"><span>Bonus installments</span>
          <input type="number" step="0.1" value={plan.bonusInstallments} onChange={set("bonusInstallments")} />
          <small className="gc-hint">Most chits add 1 free installment as a maturity bonus.</small></label>
        <label className="gc-field"><span>Purity</span>
          <select value={plan.karat} onChange={set("karat")}>
            <option value={22}>22K</option>
            <option value={24}>24K</option>
          </select></label>
        <label className="gc-field"><span>Start month</span>
          <input type="month" value={plan.startYm} onChange={set("startYm")} /></label>
        <label className="gc-field"><span>Gold rate (₹/g)</span>
          <input type="number" value={plan.rate} onChange={set("rate")} className={rateInvalid ? "gc-input-warn" : ""} />
          <button type="button" className="gc-btn-ghost" onClick={useLiveRate} style={{ marginTop: 6 }}>
            ↻ Use live {karat}K rate
          </button>
          {rateInvalid && <small className="gc-field-warn">Enter a rate or use the live rate.</small>}</label>
      </div>
      <button className="gc-btn-primary" disabled={saving} onClick={save}>
        {saving ? "Saving…" : plan.id == null ? "Create plan" : "Save changes"}
      </button>
    </section>
  );
}
