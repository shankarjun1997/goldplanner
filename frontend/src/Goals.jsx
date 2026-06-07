import React, { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, unwrapList } from "./api.js";
import { fmt, fmtGrams, fmtDate, OCCASIONS, occasionEmoji, occasionLabel, relationEmoji } from "./wealth.js";
import { normPct } from "./Dashboard.jsx";

const FESTIVAL_OCCASIONS = { akshaya_tritiya: "akshaya tritiya", dhanteras: "dhanteras" };

const yearFromNow = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export default function Goals({ setShowUpgrade }) {
  const [goals, setGoals] = useState([]);
  const [members, setMembers] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false); // occasion picker open
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [g, m, f] = await Promise.allSettled([api.listGoals(), api.listMembers(), api.festivals()]);
    if (g.status === "fulfilled") setGoals(unwrapList(g.value, "goals"));
    if (m.status === "fulfilled") setMembers(unwrapList(m.value, "members"));
    if (f.status === "fulfilled") setFestivals(unwrapList(f.value, "festivals"));
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const memberName = (id) => members.find((m) => m.id === id)?.name;

  // Occasion drives the defaults: wedding → grams mode; festival → next festival date.
  const startGoal = (occasion) => {
    let target_date = yearFromNow();
    const festName = FESTIVAL_OCCASIONS[occasion];
    if (festName) {
      const fest = festivals.find((f) => (f.name || "").toLowerCase().includes(festName));
      if (fest?.date) target_date = String(fest.date).slice(0, 10);
    }
    setForm({
      id: null,
      occasion,
      title: occasion === "custom" ? "" : `${occasionLabel(occasion)} gold`,
      member_id: "",
      mode: occasion === "wedding" || festName ? "grams" : "grams",
      target_grams: occasion === "wedding" ? 100 : "",
      target_amount: "",
      target_date,
      recurring: festName ? "yearly" : "",
    });
    setPicking(false);
  };

  const edit = (g) => setForm({
    id: g.id,
    occasion: g.occasion,
    title: g.title || "",
    member_id: g.member_id ?? "",
    mode: g.target_grams != null && g.target_grams !== "" ? "grams" : "amount",
    target_grams: g.target_grams ?? "",
    target_amount: g.target_amount ?? "",
    target_date: g.target_date ? String(g.target_date).slice(0, 10) : "",
    recurring: g.recurring ?? "",
  });

  const save = async () => {
    if (!form.title.trim()) return alert("Title is required");
    if (!form.target_date) return alert("Target date is required");
    const grams = form.mode === "grams" ? Number(form.target_grams) : null;
    const amount = form.mode === "amount" ? Number(form.target_amount) : null;
    if (form.mode === "grams" && !(grams > 0)) return alert("Target grams is required");
    if (form.mode === "amount" && !(amount > 0)) return alert("Target amount is required");
    setBusy(true);
    try {
      const payload = {
        occasion: form.occasion,
        title: form.title.trim(),
        member_id: form.member_id === "" ? null : Number(form.member_id),
        target_grams: grams,
        target_amount: amount,
        target_date: form.target_date,
        recurring: form.recurring || null,
      };
      if (form.id == null) await api.createGoal(payload);
      else await api.updateGoal(form.id, payload);
      setForm(null);
      await reload();
    } catch (e) {
      if (e.status === 402) setShowUpgrade(true);
      else alert(e.message || "Could not save goal");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g) => {
    if (!confirm(`Delete goal "${g.title}"?`)) return;
    try { await api.deleteGoal(g.id); await reload(); }
    catch (e) {
      if (e.status === 402) setShowUpgrade(true);
      else alert(e.message || "Could not delete");
    }
  };

  if (loading) return <div className="gc-center" style={{ minHeight: "40vh" }}>Loading…</div>;

  return (
    <div className="gc-content" style={{ marginTop: 20 }}>
      <section className="gc-card">
        <div className="gc-card-head">
          <h2 className="gc-h2">Gold goals</h2>
          {!picking && !form && (
            <button className="gc-btn-ghost" onClick={() => setPicking(true)}>
              <Plus size={12} style={{ verticalAlign: -2 }} /> New goal
            </button>
          )}
        </div>

        {/* ----- step 1: occasion picker ----- */}
        {picking && (
          <div className="gc-inline-form">
            <div className="gc-occasion-hint">What is this gold for?</div>
            <div className="gc-occasion-grid">
              {OCCASIONS.map((o) => (
                <button key={o.id} className="gc-occasion" onClick={() => startGoal(o.id)}>
                  <span className="gc-occasion-emoji">{o.emoji}</span>
                  <span>{o.label}</span>
                </button>
              ))}
            </div>
            <div className="gc-form-actions" style={{ marginTop: 12 }}>
              <button className="gc-btn-ghost" onClick={() => setPicking(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ----- step 2: goal form ----- */}
        {form && (
          <div className="gc-inline-form">
            <div className="gc-occasion-hint">
              {occasionEmoji(form.occasion)} {occasionLabel(form.occasion)}
              {form.id == null && (
                <button className="gc-link" style={{ marginLeft: 8 }} onClick={() => { setForm(null); setPicking(true); }}>
                  change occasion
                </button>
              )}
            </div>
            <div className="gc-grid" style={{ marginBottom: 10 }}>
              <label className="gc-field"><span>Title</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder='e.g. "Naukshitha&apos;s wedding"' /></label>
              <label className="gc-field"><span>For</span>
                <select value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
                  <option value="">—</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{relationEmoji(m.relation)} {m.name}</option>)}
                </select></label>
              <label className="gc-field"><span>Target in</span>
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  <option value="grams">Grams of gold</option>
                  <option value="amount">Rupees (₹)</option>
                </select></label>
              {form.mode === "grams" ? (
                <label className="gc-field"><span>Target (g)</span>
                  <input type="number" step="0.1" value={form.target_grams} onChange={(e) => setForm({ ...form, target_grams: e.target.value })} /></label>
              ) : (
                <label className="gc-field"><span>Target (₹)</span>
                  <input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} /></label>
              )}
              <label className="gc-field"><span>Target date</span>
                <input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></label>
              <label className="gc-field"><span>Repeats</span>
                <select value={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.value })}>
                  <option value="">Never</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select></label>
            </div>
            <div className="gc-form-actions">
              <button className="gc-btn-primary" disabled={busy} onClick={save}>
                {busy ? "Saving…" : form.id == null ? "Create goal" : "Save goal"}
              </button>
              <button className="gc-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* ----- goal cards ----- */}
        {goals.map((g) => {
          const pct = normPct(g.progressPct);
          return (
            <div key={g.id} className="gc-goal-card">
              <div className="gc-goal-top">
                <span className="gc-goal-emoji">{occasionEmoji(g.occasion)}</span>
                <div className="gc-goal-head">
                  <div className="gc-goal-title">{g.title}</div>
                  <div className="gc-goal-sub">
                    {g.member_id != null && memberName(g.member_id) ? <>for {memberName(g.member_id)} · </> : null}
                    {g.target_grams != null ? fmtGrams(g.target_grams) : fmt(g.target_amount)} by {fmtDate(g.target_date)}
                    {g.recurring ? ` · repeats ${g.recurring}` : ""}
                  </div>
                </div>
                <span className="gc-row-actions">
                  <button className="gc-mini-btn" title="Edit" onClick={() => edit(g)}><Pencil size={12} /></button>
                  <button className="gc-mini-btn danger" title="Delete" onClick={() => remove(g)}><Trash2 size={12} /></button>
                </span>
              </div>
              <div className="gc-progress">
                <div className="gc-progress-fill" style={{ width: pct + "%" }} />
              </div>
              <div className="gc-goal-stats">
                <span className="gc-goal-pct">{Math.round(pct)}% there</span>
                {g.neededGrams != null && Number(g.neededGrams) > 0 && (
                  <span>{fmtGrams(g.neededGrams)} to go</span>
                )}
                {g.monthlySaving != null && Number(g.monthlySaving) > 0 ? (
                  <b className="gc-goal-saving">Save {fmt(g.monthlySaving)}/month to stay on track</b>
                ) : pct >= 100 ? (
                  <b className="gc-goal-saving">Goal reached 🎉</b>
                ) : null}
              </div>
            </div>
          );
        })}
        {!goals.length && !picking && !form && (
          <div className="gc-empty">No goals yet — plan a wedding, festival, or gift.</div>
        )}
      </section>
    </div>
  );
}
