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
};
