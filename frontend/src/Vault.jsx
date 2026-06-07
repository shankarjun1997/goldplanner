import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { api, unwrapList } from "./api.js";
import { fmt, fmtGrams, fmtDate, RELATIONS, relationEmoji, ASSET_KINDS, kindEmoji } from "./wealth.js";

const handleErr = (e, setShowUpgrade) => {
  if (e.status === 402) setShowUpgrade(true);
  else alert(e.message || "Something went wrong");
};

export default function Vault({ setShowUpgrade }) {
  const [members, setMembers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [m, a, l] = await Promise.allSettled([api.listMembers(), api.listAssets(), api.listLoans()]);
    if (m.status === "fulfilled") setMembers(unwrapList(m.value, "members"));
    if (a.status === "fulfilled") setAssets(unwrapList(a.value, "assets"));
    if (l.status === "fulfilled") setLoans(unwrapList(l.value, "loans"));
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="gc-center" style={{ minHeight: "40vh" }}>Loading…</div>;

  return (
    <div className="gc-content" style={{ marginTop: 20 }}>
      <Members members={members} reload={reload} setShowUpgrade={setShowUpgrade} />
      <Assets members={members} assets={assets} reload={reload} setShowUpgrade={setShowUpgrade} />
      <Loans loans={loans} reload={reload} setShowUpgrade={setShowUpgrade} />
    </div>
  );
}

// ---------- family members ----------
const emptyMember = { name: "", relation: "self", birth_year: "" };

function Members({ members, reload, setShowUpgrade }) {
  const [form, setForm] = useState(null); // {id?, name, relation, birth_year}
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return alert("Name is required");
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        relation: form.relation,
        birth_year: form.birth_year ? Number(form.birth_year) : null,
      };
      if (form.id == null) await api.createMember(payload);
      else await api.updateMember(form.id, payload);
      setForm(null);
      await reload();
    } catch (e) {
      handleErr(e, setShowUpgrade);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    if (!confirm(`Remove ${m.name}? Their assets become unassigned.`)) return;
    try { await api.deleteMember(m.id); await reload(); }
    catch (e) { handleErr(e, setShowUpgrade); }
  };

  return (
    <section className="gc-card">
      <div className="gc-card-head">
        <h2 className="gc-h2">Family</h2>
        {!form && (
          <button className="gc-btn-ghost" onClick={() => setForm({ ...emptyMember })}>
            <Plus size={12} style={{ verticalAlign: -2 }} /> Add member
          </button>
        )}
      </div>

      <div className="gc-member-row">
        {members.map((m) => (
          <div key={m.id} className="gc-member-card">
            <span className="gc-member-emoji">{relationEmoji(m.relation)}</span>
            <div className="gc-member-info">
              <div className="gc-member-name">{m.name}</div>
              <div className="gc-member-sub">
                {RELATIONS.find((r) => r.id === m.relation)?.label || m.relation}
                {m.birth_year ? ` · b. ${m.birth_year}` : ""}
              </div>
            </div>
            <span className="gc-row-actions">
              <button className="gc-mini-btn" title="Edit" onClick={() => setForm({ id: m.id, name: m.name, relation: m.relation, birth_year: m.birth_year ?? "" })}><Pencil size={12} /></button>
              <button className="gc-mini-btn danger" title="Delete" onClick={() => remove(m)}><Trash2 size={12} /></button>
            </span>
          </div>
        ))}
        {!members.length && !form && <div className="gc-empty">No members yet — start with yourself.</div>}
      </div>

      {form && (
        <div className="gc-inline-form">
          <div className="gc-grid" style={{ marginBottom: 10 }}>
            <label className="gc-field"><span>Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Naukshitha" /></label>
            <label className="gc-field"><span>Relation</span>
              <select value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
                {RELATIONS.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>)}
              </select></label>
            <label className="gc-field"><span>Birth year</span>
              <input type="number" value={form.birth_year} onChange={(e) => setForm({ ...form, birth_year: e.target.value })} placeholder="e.g. 1992" /></label>
          </div>
          <div className="gc-form-actions">
            <button className="gc-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : form.id == null ? "Add member" : "Save"}</button>
            <button className="gc-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- assets ----------
const emptyAsset = {
  member_id: "", kind: "jewellery", description: "", weight_grams: "",
  karat: 22, purchase_date: "", purchase_price: "", nominee_id: "",
};

function Assets({ members, assets, reload, setShowUpgrade }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const memberName = (id) => members.find((m) => m.id === id)?.name;

  const groups = useMemo(() => {
    const byMember = new Map(members.map((m) => [m.id, { member: m, items: [] }]));
    const unassigned = [];
    for (const a of assets) {
      if (a.member_id != null && byMember.has(a.member_id)) byMember.get(a.member_id).items.push(a);
      else unassigned.push(a);
    }
    const out = [...byMember.values()].filter((g) => g.items.length);
    if (unassigned.length) out.push({ member: null, items: unassigned });
    return out;
  }, [members, assets]);

  const save = async () => {
    if (!form.description.trim()) return alert("Description is required");
    if (!form.weight_grams || Number(form.weight_grams) <= 0) return alert("Weight (grams) is required");
    setBusy(true);
    try {
      const payload = {
        member_id: form.member_id === "" ? null : Number(form.member_id),
        kind: form.kind,
        description: form.description.trim(),
        weight_grams: Number(form.weight_grams),
        karat: Number(form.karat),
        purchase_date: form.purchase_date || null,
        purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
        nominee_id: form.nominee_id === "" ? null : Number(form.nominee_id),
      };
      if (form.id == null) await api.createAsset(payload);
      else await api.updateAsset(form.id, payload);
      setForm(null);
      await reload();
    } catch (e) {
      handleErr(e, setShowUpgrade);
    } finally {
      setBusy(false);
    }
  };

  const edit = (a) => setForm({
    id: a.id,
    member_id: a.member_id ?? "",
    kind: a.kind,
    description: a.description || "",
    weight_grams: a.weight_grams ?? "",
    karat: Number(a.karat) || 22,
    purchase_date: a.purchase_date ? String(a.purchase_date).slice(0, 10) : "",
    purchase_price: a.purchase_price ?? "",
    nominee_id: a.nominee_id ?? "",
  });

  const remove = async (a) => {
    if (!confirm(`Delete "${a.description}"?`)) return;
    try { await api.deleteAsset(a.id); await reload(); }
    catch (e) { handleErr(e, setShowUpgrade); }
  };

  const assetForm = (
    <div className="gc-inline-form">
      <div className="gc-grid" style={{ marginBottom: 10 }}>
        <label className="gc-field"><span>Owner</span>
          <select value={form?.member_id ?? ""} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{relationEmoji(m.relation)} {m.name}</option>)}
          </select></label>
        <label className="gc-field"><span>Kind</span>
          <select value={form?.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {ASSET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.emoji} {k.label}</option>)}
          </select></label>
        <label className="gc-field"><span>Description</span>
          <input value={form?.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='e.g. "22g Necklace"' /></label>
        <label className="gc-field"><span>Weight (g)</span>
          <input type="number" step="0.01" value={form?.weight_grams ?? ""} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} /></label>
        <label className="gc-field"><span>Purity</span>
          <select value={form?.karat} onChange={(e) => setForm({ ...form, karat: Number(e.target.value) })}>
            <option value={22}>22K</option>
            <option value={24}>24K</option>
          </select></label>
        <label className="gc-field"><span>Purchase date</span>
          <input type="date" value={form?.purchase_date ?? ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} /></label>
        <label className="gc-field"><span>Purchase price (₹)</span>
          <input type="number" value={form?.purchase_price ?? ""} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></label>
        <label className="gc-field"><span>Nominee</span>
          <select value={form?.nominee_id ?? ""} onChange={(e) => setForm({ ...form, nominee_id: e.target.value })}>
            <option value="">None</option>
            {members.map((m) => <option key={m.id} value={m.id}>{relationEmoji(m.relation)} {m.name}</option>)}
          </select></label>
      </div>
      <div className="gc-form-actions">
        <button className="gc-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : form?.id == null ? "Add asset" : "Save"}</button>
        <button className="gc-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
      </div>
    </div>
  );

  return (
    <section className="gc-card">
      <div className="gc-card-head">
        <h2 className="gc-h2">Assets</h2>
        {!form && (
          <button className="gc-btn-ghost" onClick={() => setForm({ ...emptyAsset })}>
            <Plus size={12} style={{ verticalAlign: -2 }} /> Add asset
          </button>
        )}
      </div>

      {form && assetForm}

      {groups.map((g) => (
        <div key={g.member ? g.member.id : "unassigned"} className="gc-asset-group">
          <div className="gc-group-head">
            {g.member ? <>{relationEmoji(g.member.relation)} {g.member.name}</> : <>👤 Unassigned</>}
            <span className="gc-group-sub">{fmtGrams(g.items.reduce((s, a) => s + Number(a.weight_grams || 0), 0))}</span>
          </div>
          <div className="gc-asset-row">
            {g.items.map((a) => (
              <div key={a.id} className="gc-asset-card">
                <div className="gc-asset-top">
                  <span className="gc-asset-kind">{kindEmoji(a.kind)}</span>
                  <div className="gc-asset-desc">{a.description}</div>
                  <span className="gc-row-actions">
                    <button className="gc-mini-btn" title="Edit" onClick={() => edit(a)}><Pencil size={12} /></button>
                    <button className="gc-mini-btn danger" title="Delete" onClick={() => remove(a)}><Trash2 size={12} /></button>
                  </span>
                </div>
                <div className="gc-asset-meta">
                  <b>{fmtGrams(a.weight_grams)}</b> · {a.karat}K
                  {a.purchase_date ? <> · bought {fmtDate(a.purchase_date)}</> : null}
                </div>
                {a.currentValue != null && <div className="gc-asset-value">{fmt(a.currentValue)} today</div>}
                {a.nominee_id != null && memberName(a.nominee_id) && (
                  <div className="gc-asset-nominee">Nominee: {memberName(a.nominee_id)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {!assets.length && !form && <div className="gc-empty">No assets yet — add your first coin or jewellery.</div>}
    </section>
  );
}

// ---------- gold loans ----------
const emptyLoan = { lender: "", pledged_grams: "", principal: "", interest_pct: "", due_date: "" };

function Loans({ loans, reload, setShowUpgrade }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.lender.trim()) return alert("Lender is required");
    if (!form.due_date) return alert("Due date is required");
    setBusy(true);
    try {
      await api.createLoan({
        lender: form.lender.trim(),
        pledged_grams: Number(form.pledged_grams || 0),
        principal: Number(form.principal || 0),
        interest_pct: Number(form.interest_pct || 0),
        due_date: form.due_date,
      });
      setForm(null);
      await reload();
    } catch (e) {
      handleErr(e, setShowUpgrade);
    } finally {
      setBusy(false);
    }
  };

  const close = async (l) => {
    if (!confirm(`Mark the ${l.lender} loan as closed?`)) return;
    try { await api.updateLoan(l.id, { closed: true }); await reload(); }
    catch (e) { handleErr(e, setShowUpgrade); }
  };

  const open = loans.filter((l) => !l.closed);
  const closed = loans.filter((l) => l.closed);

  return (
    <section className="gc-card">
      <div className="gc-card-head">
        <h2 className="gc-h2"><Landmark size={15} style={{ verticalAlign: -2 }} /> Gold loans</h2>
        {!form && (
          <button className="gc-btn-ghost" onClick={() => setForm({ ...emptyLoan })}>
            <Plus size={12} style={{ verticalAlign: -2 }} /> Add loan
          </button>
        )}
      </div>

      {form && (
        <div className="gc-inline-form">
          <div className="gc-grid" style={{ marginBottom: 10 }}>
            <label className="gc-field"><span>Lender</span>
              <input value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} placeholder="e.g. Muthoot" /></label>
            <label className="gc-field"><span>Pledged gold (g)</span>
              <input type="number" step="0.01" value={form.pledged_grams} onChange={(e) => setForm({ ...form, pledged_grams: e.target.value })} /></label>
            <label className="gc-field"><span>Principal (₹)</span>
              <input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></label>
            <label className="gc-field"><span>Interest (% p.a.)</span>
              <input type="number" step="0.1" value={form.interest_pct} onChange={(e) => setForm({ ...form, interest_pct: e.target.value })} /></label>
            <label className="gc-field"><span>Due date</span>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></label>
          </div>
          <div className="gc-form-actions">
            <button className="gc-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Add loan"}</button>
            <button className="gc-btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {open.map((l) => (
        <div key={l.id} className="gc-loan-row">
          <div className="gc-loan-main">
            <div className="gc-loan-lender">{l.lender}</div>
            <div className="gc-loan-sub">
              {fmtGrams(l.pledged_grams)} pledged · {fmt(l.principal)} @ {Number(l.interest_pct)}% · due {fmtDate(l.due_date)}
            </div>
          </div>
          <div className="gc-loan-side">
            {l.daysUntilDue != null && (
              <span className={"gc-badge" + (l.daysUntilDue < 30 ? " danger" : "")}>
                {l.daysUntilDue < 0 ? `${-l.daysUntilDue}d overdue` : `${l.daysUntilDue}d left`}
              </span>
            )}
            {l.accruedInterest != null && <span className="gc-loan-interest">+{fmt(l.accruedInterest)} interest</span>}
            <button className="gc-btn-ghost" onClick={() => close(l)}>Close loan</button>
          </div>
        </div>
      ))}
      {closed.map((l) => (
        <div key={l.id} className="gc-loan-row closed">
          <div className="gc-loan-main">
            <div className="gc-loan-lender">{l.lender}</div>
            <div className="gc-loan-sub">{fmtGrams(l.pledged_grams)} · {fmt(l.principal)} @ {Number(l.interest_pct)}%</div>
          </div>
          <span className="gc-badge">Closed</span>
        </div>
      ))}
      {!loans.length && !form && <div className="gc-empty">No gold loans — may it stay that way.</div>}
    </section>
  );
}
