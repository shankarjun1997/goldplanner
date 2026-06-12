// Pure gold-chit math — no React, no DOM. Used by the planner UI, the
// exporters, and the node:test suite in ../test/chitMath.test.js.

export const nowYm = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Early plans stored `payments["2026-01"] = true`; current shape is
// { paid, rate, note }. Upgrade booleans so the rest of the app sees one shape.
function upgradePayments(payments) {
  const out = {};
  for (const [k, v] of Object.entries(payments || {})) {
    out[k] = typeof v === "boolean" ? { paid: v } : v;
  }
  return out;
}

// Server rows use snake_case; the UI works in camelCase.
export function normalizePlan(row) {
  return {
    id: row.id,
    name: row.name,
    karat: Number(row.karat),
    monthlyAmount: Number(row.monthly_amount),
    months: Number(row.months),
    bonusInstallments: Number(row.bonus_installments),
    startYm: row.start_ym,
    rate: Number(row.current_rate || 0),
    payments: upgradePayments(row.payments),
  };
}

// Classic gold-chit math. Pure — also used by the exporters.
//
// The effective `rate` is the most recent *paid* month's actual rate, falling
// back to the plan's rate. Paid months with a known rate convert at that rate
// (gramsAccumulated); everything else — future installments, the bonus, and
// paid months whose rate wasn't logged — converts at the effective rate
// (gramsProjected). gramsAtMaturity keeps the legacy whole-value formula.
export function derive(plan) {
  const schedule = Array.from({ length: plan.months }, (_, i) => {
    const key = addMonths(plan.startYm, i);
    return { index: i + 1, key, label: monthLabel(key) };
  });
  const totalContribution = plan.monthlyAmount * plan.months;
  const bonusAmount = plan.monthlyAmount * plan.bonusInstallments;
  const maturityValue = totalContribution + bonusAmount;

  const rows = schedule.map((s) => {
    const p = plan.payments?.[s.key];
    const paid = !!p?.paid;
    const rate = paid && p?.rate > 0 ? Number(p.rate) : null;
    return {
      ...s,
      paid,
      rate,
      note: (paid && p?.note) || "",
      grams: rate ? plan.monthlyAmount / rate : null,
    };
  });

  const paidRows = rows.filter((r) => r.paid);
  const paidCount = paidRows.length;
  const paidAmount = paidCount * plan.monthlyAmount;
  const converted = paidRows.filter((r) => r.grams != null);
  const gramsAccumulated = converted.reduce((t, r) => t + r.grams, 0);

  const rate = converted.length ? converted[converted.length - 1].rate : plan.rate;
  const gramsAtMaturity = rate ? maturityValue / rate : 0;
  const unconvertedValue = maturityValue - converted.length * plan.monthlyAmount;
  const gramsProjected = rate ? gramsAccumulated + unconvertedValue / rate : 0;

  return {
    schedule,
    rows,
    totalContribution,
    bonusAmount,
    maturityValue,
    paidCount,
    paidAmount,
    gramsAccumulated,
    gramsProjected,
    gramsAtMaturity,
    rate,
  };
}
