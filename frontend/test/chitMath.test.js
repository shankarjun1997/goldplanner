import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addMonths, monthLabel, nowYm, normalizePlan, derive } from "../src/chitMath.js";

const basePlan = (over = {}) => ({
  id: 1,
  name: "Test chit",
  karat: 22,
  monthlyAmount: 5000,
  months: 11,
  bonusInstallments: 1,
  startYm: "2026-01",
  rate: 7500,
  payments: {},
  ...over,
});

describe("addMonths", () => {
  test("adds within a year", () => {
    assert.equal(addMonths("2026-01", 3), "2026-04");
  });
  test("rolls over the year", () => {
    assert.equal(addMonths("2026-11", 2), "2027-01");
  });
  test("zero is identity", () => {
    assert.equal(addMonths("2026-06", 0), "2026-06");
  });
});

describe("normalizePlan", () => {
  test("maps snake_case server row to camelCase numbers", () => {
    const p = normalizePlan({
      id: 7,
      name: "GRT chit",
      karat: "22",
      monthly_amount: "5000",
      months: "11",
      bonus_installments: "1",
      start_ym: "2026-01",
      current_rate: "7100.5",
      payments: { "2026-01": { paid: true, rate: 7000 } },
    });
    assert.equal(p.id, 7);
    assert.equal(p.karat, 22);
    assert.equal(p.monthlyAmount, 5000);
    assert.equal(p.months, 11);
    assert.equal(p.bonusInstallments, 1);
    assert.equal(p.startYm, "2026-01");
    assert.equal(p.rate, 7100.5);
    assert.deepEqual(p.payments["2026-01"], { paid: true, rate: 7000 });
  });

  test("defaults payments to empty object", () => {
    const p = normalizePlan({ id: 1, monthly_amount: 1, months: 1, bonus_installments: 0, karat: 22, current_rate: 0, start_ym: "2026-01", payments: null });
    assert.deepEqual(p.payments, {});
  });

  test("upgrades legacy boolean payments to objects", () => {
    const p = normalizePlan({
      id: 1, monthly_amount: 1, months: 2, bonus_installments: 0, karat: 22,
      current_rate: 0, start_ym: "2026-01",
      payments: { "2026-01": true, "2026-02": false },
    });
    assert.deepEqual(p.payments["2026-01"], { paid: true });
    assert.deepEqual(p.payments["2026-02"], { paid: false });
  });
});

describe("derive — existing behavior", () => {
  test("builds one schedule row per month from startYm", () => {
    const d = derive(basePlan());
    assert.equal(d.schedule.length, 11);
    assert.equal(d.schedule[0].key, "2026-01");
    assert.equal(d.schedule[10].key, "2026-11");
    assert.equal(d.schedule[0].label, monthLabel("2026-01"));
  });

  test("computes contribution, bonus, maturity", () => {
    const d = derive(basePlan());
    assert.equal(d.totalContribution, 55000);
    assert.equal(d.bonusAmount, 5000);
    assert.equal(d.maturityValue, 60000);
  });

  test("uses plan rate when no payments carry rates", () => {
    const d = derive(basePlan());
    assert.equal(d.rate, 7500);
    assert.equal(d.gramsAtMaturity, 60000 / 7500);
  });

  test("prefers the most recent paid rate over the plan rate", () => {
    const d = derive(basePlan({
      payments: {
        "2026-01": { paid: true, rate: 7000 },
        "2026-03": { paid: true, rate: 7200 },
      },
    }));
    assert.equal(d.rate, 7200);
    assert.equal(d.gramsAtMaturity, 60000 / 7200);
  });

  test("grams at maturity is 0 when no rate is known", () => {
    const d = derive(basePlan({ rate: 0 }));
    assert.equal(d.gramsAtMaturity, 0);
  });

  test("nowYm returns YYYY-MM", () => {
    assert.match(nowYm(), /^\d{4}-\d{2}$/);
  });
});

describe("derive — per-row payment tracking (#4)", () => {
  const tracked = () =>
    basePlan({
      payments: {
        "2026-01": { paid: true, rate: 7000 },
        "2026-02": { paid: true, rate: 7200, note: "GRT branch" },
      },
    });

  test("returns enriched rows aligned with the schedule", () => {
    const d = derive(tracked());
    assert.equal(d.rows.length, 11);
    assert.equal(d.rows[0].key, "2026-01");
    assert.equal(d.rows[0].paid, true);
    assert.equal(d.rows[0].rate, 7000);
    assert.equal(d.rows[0].grams, 5000 / 7000);
    assert.equal(d.rows[0].note, "");
  });

  test("carries the per-month note through", () => {
    const d = derive(tracked());
    assert.equal(d.rows[1].note, "GRT branch");
  });

  test("unpaid rows have no rate or grams", () => {
    const d = derive(tracked());
    assert.equal(d.rows[2].paid, false);
    assert.equal(d.rows[2].rate, null);
    assert.equal(d.rows[2].grams, null);
  });

  test("accumulates grams across paid months with known rates", () => {
    const d = derive(tracked());
    assert.equal(d.gramsAccumulated, 5000 / 7000 + 5000 / 7200);
  });

  test("counts paid installments and amount", () => {
    const d = derive(tracked());
    assert.equal(d.paidCount, 2);
    assert.equal(d.paidAmount, 10000);
  });

  test("projects maturity grams from actuals plus remaining value at the effective rate", () => {
    const d = derive(tracked());
    // 2 of 11 paid at known rates → ₹50,000 (9 future + bonus) still converts at 7200.
    const expected = 5000 / 7000 + 5000 / 7200 + 50000 / 7200;
    assert.equal(d.gramsProjected, expected);
  });

  test("paid month without a rate counts as paid but converts at the effective rate", () => {
    const d = derive(basePlan({ payments: { "2026-01": { paid: true, rate: 0 } } }));
    assert.equal(d.paidCount, 1);
    assert.equal(d.rows[0].grams, null);
    assert.equal(d.gramsAccumulated, 0);
    assert.equal(d.gramsProjected, 60000 / 7500);
  });

  test("ignores rates on rows that are not paid", () => {
    // Toggling a row off keeps its old rate; that rate must not drive the projection.
    const d = derive(basePlan({ payments: { "2026-01": { paid: false, rate: 6000 } } }));
    assert.equal(d.rate, 7500);
    assert.equal(d.gramsAccumulated, 0);
  });

  test("everything is 0 when no rate is known anywhere", () => {
    const d = derive(basePlan({ rate: 0 }));
    assert.equal(d.gramsAccumulated, 0);
    assert.equal(d.gramsProjected, 0);
  });
});
