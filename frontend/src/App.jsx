import React, { useEffect, useState } from "react";
import { LayoutDashboard, Coins, Vault as VaultIcon, Target } from "lucide-react";
import { useAuth } from "./auth.jsx";
import { api, unwrapList } from "./api.js";
import PricingModal from "./PricingModal.jsx";
import GoldChitPlanner, { AuthScreen } from "./GoldChitPlanner.jsx";
import Dashboard from "./Dashboard.jsx";
import Vault from "./Vault.jsx";
import Goals from "./Goals.jsx";

const TABS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "plans", label: "Plans", Icon: Coins },
  { id: "vault", label: "Vault", Icon: VaultIcon },
  { id: "goals", label: "Goals", Icon: Target },
];

export default function App() {
  const { user, loading, login, signup, logout, refresh } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [tab, setTab] = useState(null); // null until we know the default
  const [ticker, setTicker] = useState(null);

  // Live gold-rate ticker for the header (cached server-side; no provider hit).
  useEffect(() => {
    if (!user) return;
    let alive = true;
    api.goldTicker().then((t) => alive && setTicker(t)).catch(() => {});
    return () => { alive = false; };
  }, [user]);

  // After returning from Stripe success_url (?upgraded=1), refresh premium status.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("upgraded")) {
      refresh();
      window.history.replaceState({}, "", location.pathname);
    }
  }, []);

  // Default tab: Dashboard if the user already has assets, else Plans.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      let next = "plans";
      try {
        const assets = unwrapList(await api.listAssets(), "assets");
        if (assets.length) next = "dashboard";
      } catch {
        /* backend not ready / no assets — land on Plans */
      }
      if (alive) setTab((t) => t ?? next);
    })();
    return () => { alive = false; };
  }, [user]);

  if (loading) return <div className="gc-center">Loading…</div>;
  if (!user) return <AuthScreen login={login} signup={signup} />;
  if (!tab) return <div className="gc-center">Loading…</div>;

  return (
    <div className="gc-app">
      <header className="gc-header">
        <div className="gc-brand">◆ GoldPlanner</div>
        <div className="gc-actions">
          {ticker?.rate22 ? (
            <span
              className="gc-pill ticker"
              title={"22K gold rate" + (ticker.at ? " · as of " + new Date(ticker.at).toLocaleDateString("en-IN") : "")}
            >
              22K ₹{new Intl.NumberFormat("en-IN").format(ticker.rate22)}/g
            </span>
          ) : null}
          {user.is_premium && <span className="gc-pill premium">Premium</span>}
          {!user.is_premium && (
            <button className="gc-pill rec" onClick={() => setShowUpgrade(true)}>★ Upgrade</button>
          )}
          <button className="gc-icon-btn" onClick={logout} title="Sign out">⎋</button>
        </div>
      </header>

      <nav className="gc-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={"gc-tab" + (tab === id ? " active" : "")}
            onClick={() => setTab(id)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <Dashboard onGoTo={setTab} />}
      {tab === "plans" && <GoldChitPlanner user={user} setShowUpgrade={setShowUpgrade} />}
      {tab === "vault" && <Vault setShowUpgrade={setShowUpgrade} />}
      {tab === "goals" && <Goals setShowUpgrade={setShowUpgrade} />}

      {showUpgrade && <PricingModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
