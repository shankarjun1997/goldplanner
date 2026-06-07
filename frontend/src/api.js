const BASE = "/api";

let token = localStorage.getItem("gp_token") || null;

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem("gp_token", t);
  else localStorage.removeItem("gp_token");
}
export function getToken() {
  return token;
}

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (email, password) => req("/auth/signup", { method: "POST", body: { email, password } }),
  login: (email, password) => req("/auth/login", { method: "POST", body: { email, password } }),
  me: () => req("/auth/me"),
  listPlans: () => req("/plans"),
  createPlan: (plan) => req("/plans", { method: "POST", body: plan }),
  updatePlan: (id, patch) => req(`/plans/${id}`, { method: "PUT", body: patch }),
  deletePlan: (id) => req(`/plans/${id}`, { method: "DELETE" }),
  checkout: (plan) => req("/billing/checkout", { method: "POST", body: { plan } }),
  goldRate: (karat) => req(`/gold/rate?karat=${karat}`),

  // ----- Gold Wealth OS (Phase 1) -----
  listMembers: () => req("/members"),
  createMember: (m) => req("/members", { method: "POST", body: m }),
  updateMember: (id, patch) => req(`/members/${id}`, { method: "PUT", body: patch }),
  deleteMember: (id) => req(`/members/${id}`, { method: "DELETE" }),

  listAssets: () => req("/assets"),
  createAsset: (a) => req("/assets", { method: "POST", body: a }),
  updateAsset: (id, patch) => req(`/assets/${id}`, { method: "PUT", body: patch }),
  deleteAsset: (id) => req(`/assets/${id}`, { method: "DELETE" }),

  listGoals: () => req("/goals"),
  createGoal: (g) => req("/goals", { method: "POST", body: g }),
  updateGoal: (id, patch) => req(`/goals/${id}`, { method: "PUT", body: patch }),
  deleteGoal: (id) => req(`/goals/${id}`, { method: "DELETE" }),

  networth: () => req("/networth"),
  networthHistory: () => req("/networth/history"),
  festivals: () => req("/festivals"),

  listLoans: () => req("/loans"),
  createLoan: (l) => req("/loans", { method: "POST", body: l }),
  updateLoan: (id, patch) => req(`/loans/${id}`, { method: "PUT", body: patch }),
  deleteLoan: (id) => req(`/loans/${id}`, { method: "DELETE" }),
};

// List endpoints may return a bare array or an enveloped object
// ({members:[…]}, like /plans returns {plans:[…]}). Accept both.
export function unwrapList(data, key) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data[key])) return data[key];
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}
