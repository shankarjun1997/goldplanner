const fmt = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n || 0));

export function exportCSV(plan, d) {
  let csv = "Month #,Month,Installment,Status,Rate/g,Grams\n";
  d.schedule.forEach((s) => {
    const p = plan.payments[s.key];
    const g = p?.paid && p.rate > 0 ? (plan.monthlyAmount / p.rate).toFixed(2) : "";
    csv += `${s.index},${s.label},${plan.monthlyAmount},${p?.paid ? "Paid" : "Pending"},${p?.rate || ""},${g}\n`;
  });
  csv += `\nTotal contribution,${d.totalContribution}\nBonus,${d.bonusAmount}\nMaturity value,${d.maturityValue}\n`;
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gold-chit.csv";
  a.click();
}

export function exportPDF(plan, d) {
  const rows = d.schedule.map((s) => {
    const p = plan.payments[s.key];
    return `<tr><td>${s.index}</td><td>${s.label}</td><td>${fmt(plan.monthlyAmount)}</td>
      <td>${p?.paid ? "Paid" : "Pending"}</td><td>${p?.rate ? fmt(p.rate) + "/g" : "—"}</td></tr>`;
  }).join("");
  const win = window.open("", "_blank");
  win.document.write(`<!doctype html><html><head><title>Gold Chit Report</title>
    <style>body{font-family:system-ui;color:#1c160e;padding:32px}h1{font-size:22px}
    .sum{display:flex;gap:24px;margin:16px 0}.sum div b{display:block;font-size:18px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f6f1e3}</style></head>
    <body><h1>Gold Chit — ${plan.karat}K Savings Report</h1>
    <div class="sum">
      <div><span>Contribution</span><b>${fmt(d.totalContribution)}</b></div>
      <div><span>Bonus</span><b>${fmt(d.bonusAmount)}</b></div>
      <div><span>Maturity value</span><b>${fmt(d.maturityValue)}</b></div>
      <div><span>Gold at maturity</span><b>${d.gramsAtMaturity.toFixed(2)} g</b></div>
    </div>
    <table><thead><tr><th>#</th><th>Month</th><th>Installment</th><th>Status</th><th>Rate</th></tr></thead>
    <tbody>${rows}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250); // user picks "Save as PDF" in the print dialog
}
