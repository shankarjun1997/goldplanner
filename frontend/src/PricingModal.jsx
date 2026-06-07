import React, { useState } from "react";
import { Sparkles, X, Check } from "lucide-react";
import { api } from "./api.js";

const TIERS = [
  { id: "monthly",  name: "Monthly",  price: "₹99 / mo",   note: "Cancel anytime" },
  { id: "annual",   name: "Annual",   price: "₹899 / yr",  note: "Save ~25%", best: true },
  { id: "lifetime", name: "Lifetime", price: "₹2,499 once", note: "Pay once, keep forever" },
];
const PERKS = ["Unlimited chit plans", "Live gold-rate auto-update", "PDF & CSV export"];

export default function PricingModal({ onClose }) {
  const [busy, setBusy] = useState(null);
  const go = async (id) => {
    setBusy(id);
    try { const { url } = await api.checkout(id); window.location.href = url; }
    catch (e) { alert(e.message || "Could not start checkout"); setBusy(null); }
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.head}><span>Upgrade to Premium</span>
          <button style={S.x} onClick={onClose}><X size={16} /></button></div>
        <div style={S.perks}>{PERKS.map((p) => (
          <div key={p} style={S.perk}><Check size={14} color="#E2C871" /> {p}</div>))}</div>
        <div style={S.tiers}>{TIERS.map((t) => (
          <button key={t.id} style={{ ...S.tier, ...(t.best ? S.best : {}) }}
            disabled={!!busy} onClick={() => go(t.id)}>
            {t.best && <span style={S.badge}>Best value</span>}
            <div style={S.tierName}>{t.name}</div>
            <div style={S.tierPrice}>{t.price}</div>
            <div style={S.tierNote}>{t.note}</div>
            <div style={S.cta}><Sparkles size={14} /> {busy === t.id ? "Redirecting…" : "Choose"}</div>
          </button>))}</div>
      </div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, zIndex: 30, background: "rgba(8,6,3,.66)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Manrope, sans-serif" },
  modal: { width: "100%", maxWidth: 560, background: "linear-gradient(180deg,#211a10,#181208)",
    border: "1px solid rgba(201,168,76,.16)", borderRadius: 22, padding: 24, color: "#F3EBDA" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, fontWeight: 700, marginBottom: 14 },
  x: { width: 34, height: 34, borderRadius: 10, background: "#1C160E", border: "1px solid rgba(201,168,76,.16)", color: "#A1937A", cursor: "pointer" },
  perks: { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18, fontSize: 13, color: "#D8CBB0" },
  perk: { display: "flex", alignItems: "center", gap: 6 },
  tiers: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 },
  tier: { position: "relative", textAlign: "left", background: "#15110A", border: "1px solid rgba(201,168,76,.16)",
    borderRadius: 16, padding: 16, cursor: "pointer", color: "#F3EBDA" },
  best: { border: "1px solid rgba(226,200,113,.5)", background: "linear-gradient(150deg,#3a2d14,#1c160e)" },
  badge: { position: "absolute", top: -9, right: 12, fontSize: 10, fontWeight: 700, color: "#1c1408",
    background: "linear-gradient(145deg,#F2E2A8,#C9A84C)", padding: "3px 8px", borderRadius: 7 },
  tierName: { fontSize: 13, color: "#A1937A", fontWeight: 600 },
  tierPrice: { fontSize: 20, fontWeight: 700, margin: "4px 0 2px", fontFamily: "Fraunces, serif" },
  tierNote: { fontSize: 11.5, color: "#6E6450", marginBottom: 12 },
  cta: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#E2C871" },
};
