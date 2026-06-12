# GoldPlanner — Refinement Backlog

Snapshot of where the project stands after Phase 1, the UX critique reconciled against
the actual code, and a prioritized list of what to build next.

## Where the project is

- **Shipped (Phase 1):** 4-tab app (Dashboard, Plans, Vault, Goals). Backend engines
  for members, assets, goals, net worth, festivals, loans. Gold-rate cache (1h TTL).
  Verified: backend syntax, pg-mem schema test, frontend build all pass.
- **Not yet on GitHub:** Phase 1 commit is blocked by stale git lock files on the Mac;
  run `rm -f .git/HEAD.lock .git/index.lock && git add -A && git commit && git push`.
- **Stack:** Express + Postgres + Stripe; React + Vite, hand-written CSS, lucide icons.

## Critique reconciled — already built, not missing

The UX critique reviewed an earlier screenshot. These flagged "gaps" already exist in code:

| Critique said missing | Reality |
|---|---|
| "Add asset form is completely absent" | Built in `Vault.jsx` (full form: kind, weight, karat, date, price, member, nominee) |
| "No progress tracking UI for goals" | Built in `Goals.jsx` — progress bar + "Save ₹X/month" line per goal |
| "Loan section underbuilt, no alerts" | `daysUntilDue` + red `<30d` badge + `accruedInterest` already render |
| "Upcoming card should surface festivals" | Dashboard already pulls `/api/festivals` with countdowns |

Action: re-test against the **current** build before treating these as work.

## Genuinely remaining — prioritized

### 🔴 Critical (activation + "feels broken")
1. **Gold rate defaults to 0** → summary shows "0.00 g", looks broken. Auto-fetch the
   live 22K rate into the field on plan-form open (premium) or block the summary with a
   "Set a gold rate" prompt (free). Validate rate > 0 before rendering the schedule.
2. **Onboarding / guided setup** — new users see four zeros. Add a 3-step checklist card
   on the Dashboard: Add yourself → Create first plan → Set a goal. Dismissible, persists
   per user.
3. **Empty states do real work** — replace filler ("Rate history builds up…") with an
   icon + primary action button inside each card ("Add your first asset →").

### 🟠 High (planning utility)
4. **Per-row payment tracking** — today each schedule row only toggles "Mark paid". Let
   users log the *actual rate/g paid* and a note per month (real chits are tracked
   retroactively). Lights up the Rate/g + Grams columns.
5. **Goal-to-plan linking** — link a chit plan as a goal's funding source; show projected
   completion vs target date with green/amber/red status. Biggest planning win.
6. **Asset portfolio overview** — Vault has per-asset cards; add a summary grid/table with
   each item's current value (weight × live rate) and unrealized gain vs purchase price.
7. **Live rate in header** — persistent ticker ("22K ₹6,840/g ↑"). Reinforces value every
   visit; data already cached server-side.
8. **Plan-form quick wins** — clear/select default name "My Gold Chit" on focus; bonus-
   installment info tooltip; rate-0 validation (ties to #1).

### 🟡 Medium (completeness)
9. **Settings / profile page** — avatar menu top-right (currently only a bare "Sign out");
   default purity, notification prefs, data export, account delete.
10. **Mobile responsiveness** — fixed-width panels; audience is mobile-first. Make the
    4-tab layout and forms responsive.
11. **Freemium clarity** — surface usage in-context ("1 of 1 free plans used") + a Free vs
    Premium comparison table in the pricing modal.
12. **Header history icon** — unlabeled clock button needs a tooltip/aria-label.
13. **Vault input fixes** — birth year as number input (min/max + validation); add Sister,
    Brother, Grandparents, In-laws to relations.

### 🟢 Polish
14. Empty-state illustrations; ghost/blurred sample chart instead of dashed placeholder.
15. Secondary (outlined) button style so Cancel vs primary CTA read as a hierarchy.
16. Bump form-label contrast (muted text is low-contrast on dark).
17. Consistent icon family across tabs; "Sept" → "Sep" in schedule.

## Already roadmapped (Phase 2/3 in PRODUCT_SPEC.md)
Notifications/reminders, AI advisor, invoice vault, analytics/reports, chit marketplace —
these cover the critique's "missing features" section. No change needed to that plan.

## Suggested next sprint
#1, #2, #3 (critical), then #4 and #5 (the two highest-leverage planning features).
That set turns the app from "looks like a prototype" into "feels finished" for a demo.
