/* ════════════════════════════════════════════════════════════
   OTW — Financial Analytics & Reporting
   Charts (Chart.js), monthly summary, CSV export, printable
   financial statement (save as PDF from the print dialog)
   ════════════════════════════════════════════════════════════ */

const CHART_COLORS = ['#047857', '#d4a017', '#0e7490', '#7c3aed', '#be185d', '#b45309', '#1d4ed8', '#0f766e', '#a16207', '#475569'];
const chartRegistry = {};

function makeChart(id, config) {
  if (typeof Chart === 'undefined') return;
  const el = $(id);
  if (!el) return;
  if (chartRegistry[id]) chartRegistry[id].destroy();
  Chart.defaults.font.family = "'Hind Siliguri','Inter',sans-serif";
  chartRegistry[id] = new Chart(el, config);
}

function categoryTotals(type, list) {
  const map = {};
  (list || db.transactions).filter(x => x.type === type).forEach(x => {
    map[x.category] = (map[x.category] || 0) + (+x.amount || 0);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function last6MonthsSeries() {
  const labels = [], income = [], expense = [];
  const now = new Date();
  for (let back = 5; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const mt = monthTotals(key);
    labels.push(monthLabel(d.getFullYear(), d.getMonth()));
    income.push(mt.income);
    expense.push(mt.expense);
  }
  return { labels, income, expense };
}

/* ── Dashboard charts ───────────────────────────────────── */
function renderDashboardCharts() {
  const s = last6MonthsSeries();
  makeChart('chartMonthly', {
    type: 'bar',
    data: {
      labels: s.labels,
      datasets: [
        { label: t('income'), data: s.income, backgroundColor: '#059669', borderRadius: 6, barPercentage: .55 },
        { label: t('expense'), data: s.expense, backgroundColor: '#fb7185', borderRadius: 6, barPercentage: .55 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => fmtNum(v) } },
        x: { grid: { display: false } }
      }
    }
  });

  const expCats = categoryTotals('expense');
  makeChart('chartExpenseCat', {
    type: 'doughnut',
    data: {
      labels: expCats.map(([c]) => catName(c)),
      datasets: [{ data: expCats.map(([, v]) => v), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtMoney(c.parsed)}` } }
      }
    }
  });
}

/* ── Reports page ───────────────────────────────────────── */
function reportYears() {
  const years = new Set([new Date().getFullYear()]);
  db.transactions.forEach(x => years.add(+x.date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

function renderReports() {
  const yearSel = $('reportYear');
  const prev = yearSel.value;
  yearSel.innerHTML = reportYears().map(y => `<option value="${y}">${num(y)}</option>`).join('');
  yearSel.value = prev && reportYears().includes(+prev) ? prev : String(new Date().getFullYear());
  const year = +yearSel.value;

  const yearTxns = db.transactions.filter(x => +x.date.slice(0, 4) === year);
  const yIncome = totalIncome(yearTxns), yExpense = totalExpense(yearTxns);
  $('repYearIncome').textContent = fmtMoney(yIncome);
  $('repYearExpense').textContent = fmtMoney(yExpense);
  $('repYearNet').textContent = fmtMoney(yIncome - yExpense, true);

  /* Monthly series + table */
  const labels = [], inc = [], exp = [];
  let monthlyRows = '';
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const mt = monthTotals(key);
    labels.push(monthLabel(year, m));
    inc.push(mt.income); exp.push(mt.expense);
    monthlyRows += `<tr>
      <td class="font-medium">${monthLabel(year, m, 'long')}</td>
      <td class="text-right text-brand-700 font-semibold">${fmtMoney(mt.income)}</td>
      <td class="text-right text-rose-600 font-semibold">${fmtMoney(mt.expense)}</td>
      <td class="text-right font-semibold">${fmtMoney(mt.income - mt.expense, true)}</td>
    </tr>`;
  }
  $('monthlyTableBody').innerHTML = monthlyRows + `<tr class="bg-slate-50 font-bold">
      <td>${t('colTotal')}</td>
      <td class="text-right text-brand-700">${fmtMoney(yIncome)}</td>
      <td class="text-right text-rose-600">${fmtMoney(yExpense)}</td>
      <td class="text-right">${fmtMoney(yIncome - yExpense, true)}</td>
    </tr>`;

  makeChart('chartTrend', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: t('income'), data: inc, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.12)', fill: true, tension: .4, pointRadius: 3 },
        { label: t('expense'), data: exp, borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,.10)', fill: true, tension: .4, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 16 } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => fmtNum(v) } },
        x: { grid: { display: false } }
      }
    }
  });

  const incCats = categoryTotals('income', yearTxns);
  makeChart('chartIncomeCat', {
    type: 'doughnut',
    data: {
      labels: incCats.map(([c]) => catName(c)),
      datasets: [{ data: incCats.map(([, v]) => v), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${fmtMoney(c.parsed)}` } }
      }
    }
  });

  /* Category breakdown table (income + expense) */
  const grandTotal = yIncome + yExpense;
  const rows = [];
  const addRows = (type) => {
    categoryTotals(type, yearTxns).forEach(([cat, total]) => {
      const count = yearTxns.filter(x => x.type === type && x.category === cat).length;
      const pct = grandTotal ? (total / grandTotal * 100) : 0;
      rows.push(`<tr>
        <td><span class="chip">${catName(cat)}</span> <span class="pill ${type === 'income' ? 'pill-green' : 'pill-red'} ml-1">${t(type)}</span></td>
        <td class="text-right">${fmtNum(count)}</td>
        <td class="text-right font-semibold ${type === 'income' ? 'text-brand-700' : 'text-rose-600'}">${fmtMoney(total)}</td>
        <td class="text-right text-slate-500">${fmtNum(pct.toFixed(1))}%</td>
      </tr>`);
    });
  };
  addRows('income'); addRows('expense');
  $('catTableBody').innerHTML = rows.join('') ||
    `<tr><td colspan="4" class="text-center text-slate-400 py-8">${t('noData')}</td></tr>`;
}

/* ── CSV export ─────────────────────────────────────────── */
function exportCSV() {
  const year = +($('reportYear').value || new Date().getFullYear());
  const balances = runningBalances();
  const rows = [[t('colDate'), t('colDesc'), t('fVendor'), t('colCategory'), t('income') + '/' + t('expense'), t('fAmount'), t('colBalance')]];
  sortedTxns().filter(x => +x.date.slice(0, 4) === year).forEach(x => {
    rows.push([x.date, x.description || '', x.vendor || '', catName(x.category), t(x.type), x.amount, balances[x.id] || 0]);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadBlob(csv, `OTW-Statement-${year}.csv`, 'text/csv;charset=utf-8');
  showToast(t('csvExported'));
}

/* ── Printable financial statement (→ PDF via print dialog) ── */
function printStatement() {
  const year = +($('reportYear').value || new Date().getFullYear());
  const balances = runningBalances();
  const list = sortedTxns().filter(x => +x.date.slice(0, 4) === year);
  const yIncome = totalIncome(list), yExpense = totalExpense(list);
  const orgName = currentLang === 'bn' ? db.settings.orgName : (db.settings.orgNameEn || db.settings.orgName);

  const rowsHtml = list.map(x => `<tr>
    <td>${fmtDate(x.date)}</td>
    <td>${esc(x.description || '')}${x.vendor ? `<br><small style="color:#64748b">${esc(x.vendor)}</small>` : ''}</td>
    <td>${catName(x.category)}</td>
    <td class="r" style="color:#047857">${x.type === 'income' ? fmtNum(x.amount) : '—'}</td>
    <td class="r" style="color:#be123c">${x.type === 'expense' ? fmtNum(x.amount) : '—'}</td>
    <td class="r"><b>${fmtNum(balances[x.id] || 0)}</b></td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="${currentLang}"><head><meta charset="UTF-8">
  <title>${t('financialStatement')} — ${num(year)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family:'Hind Siliguri',sans-serif; box-sizing:border-box; }
    body { margin:0; padding:32px; color:#1e293b; }
    .head { background:linear-gradient(120deg,#022c22,#047857); color:#fff; border-radius:14px; padding:22px 26px; }
    .head h1 { margin:0; font-size:24px; } .head p { margin:2px 0 0; color:#a7f3d0; font-size:13px; }
    .head .gold { height:4px; background:linear-gradient(90deg,#b8860b,#f3d27a,#b8860b); border-radius:4px; margin-top:14px; }
    h2 { font-size:18px; margin:22px 0 4px; } .sub { color:#64748b; font-size:13px; margin:0 0 16px; }
    .cards { display:flex; gap:14px; margin-bottom:20px; }
    .card { flex:1; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; background:#f8fafc; }
    .card small { color:#64748b; } .card b { font-size:19px; display:block; margin-top:2px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; background:#065f46; color:#fff; padding:9px 10px; }
    td { padding:7px 10px; border-bottom:1px solid #eef2f7; vertical-align:top; }
    .r { text-align:right; } th.r { text-align:right; }
    tfoot td { font-weight:700; background:#f8fafc; border-top:2px solid #065f46; }
    .sign { display:flex; justify-content:space-between; margin-top:64px; font-size:13px; color:#475569; }
    .sign div { text-align:center; } .line { border-top:1px solid #94a3b8; width:200px; margin:0 auto 6px; }
    @media print { body { padding:12px; } @page { margin:12mm; } }
  </style></head><body>
    <div class="head"><h1>${esc(orgName)}</h1><p>${esc(db.settings.orgAddress || '')} • ${t('appTagline')}</p><div class="gold"></div></div>
    <h2>${t('financialStatement')} — ${num(year)}</h2>
    <p class="sub">${t('generatedOn')}: ${fmtDate(todayISO())}</p>
    <div class="cards">
      <div class="card"><small>${t('yearIncome')}</small><b style="color:#047857">${fmtMoney(yIncome)}</b></div>
      <div class="card"><small>${t('yearExpense')}</small><b style="color:#be123c">${fmtMoney(yExpense)}</b></div>
      <div class="card"><small>${t('netBalance')}</small><b style="color:#b8860b">${fmtMoney(currentBalance())}</b></div>
    </div>
    <table>
      <thead><tr><th>${t('colDate')}</th><th>${t('colDesc')}</th><th>${t('colCategory')}</th><th class="r">${t('colIncome')}</th><th class="r">${t('colExpense')}</th><th class="r">${t('colBalance')}</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td colspan="3">${t('colTotal')}</td><td class="r" style="color:#047857">${fmtNum(yIncome)}</td><td class="r" style="color:#be123c">${fmtNum(yExpense)}</td><td class="r">${fmtNum(currentBalance())}</td></tr></tfoot>
    </table>
    <div class="sign">
      <div><div class="line"></div>${t('signatureTreasurer')}</div>
      <div><div class="line"></div>${t('signaturePresident')}</div>
    </div>
    <script>window.onload = () => setTimeout(() => window.print(), 400);<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast(t('scanFail'), 'error'); return; }
  w.document.write(html);
  w.document.close();
}
