/* ════════════════════════════════════════════════════════════
   OTW — Financial Management & Cash Book (জমা-খরচ)
   ════════════════════════════════════════════════════════════ */

let finTypeFilter = 'all';
let finSportsOnly = false;


function monthTotals(monthKey) {
const list = db.transactions.filter(t => txnCoversMonth(t, monthKey));
return {
   income: list.filter(t => t.type === 'income').reduce((s, t) => s + txnAmountInMonth(t, monthKey), 0),
   expense: list.filter(t => t.type === 'expense').reduce((s, t) => s + txnAmountInMonth(t, monthKey), 0)
};
}

function renderFinance() {
   ensureSportsChip();
  /* Summary strip */
  $('finBalance').textContent = fmtMoney(currentBalance());
  const mt = monthTotals(currentMonthKey());
  $('finMonthIncome').textContent = fmtMoney(mt.income);
  $('finMonthExpense').textContent = fmtMoney(mt.expense);

  /* Filters */
  const q = ($('finSearch').value || '').trim().toLowerCase();
  const cat = $('finCategoryFilter').value;
  const month = $('finMonthFilter').value;
  const balances = runningBalances();

  const list = sortedTxns().filter(tx => {
    if (finTypeFilter !== 'all' && tx.type !== finTypeFilter) return false;
    if (cat && tx.category !== cat) return false;
if (month && !txnCoversMonth(tx, month)) return false;
   
     if (finSportsOnly && !isSportsTxn(tx)) return false;
    if (q && !((tx.description || '').toLowerCase().includes(q) || (tx.vendor || '').toLowerCase().includes(q))) return false;
    return true;
  }).reverse(); // newest first

  $('txnTableBody').innerHTML = list.map(tx => {
    const isInc = tx.type === 'income';
    const member = tx.memberId ? db.members.find(m => m.id === tx.memberId) : null;
    const sub = [tx.vendor, member ? member.name : ''].filter(Boolean).join(' • ');
     const dispAmt = month ? txnAmountInMonth(tx, month) : (+tx.amount || 0);
    return `<tr>
      <td class="whitespace-nowrap text-slate-600">${fmtDate(tx.date)}</td>
      <td>
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg ${isInc ? 'bg-brand-50 text-brand-600' : 'bg-rose-50 text-rose-500'} flex items-center justify-center shrink-0">
            <i class="fa-solid ${isInc ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs"></i>
          </span>
          <div class="min-w-0">
            <p class="font-medium text-slate-800 truncate max-w-[280px]">${esc(tx.description || catName(tx.category))}</p>
            ${sub ? `<p class="text-xs text-slate-400 truncate max-w-[280px]">${esc(sub)}</p>` : ''}
          </div>
        </div>
      </td>
      <td><span class="chip">${catName(tx.category)}</span></td>
      <td class="text-right font-semibold text-brand-700 whitespace-nowrap">${isInc ? fmtMoney(dispAmt) : '<span class="text-slate-300">—</span>'}</td>
      <td class="text-right font-semibold text-rose-600 whitespace-nowrap">${!isInc ? fmtMoney(dispAmt) : '<span class="text-slate-300">—</span>'}</td>
      <td class="text-right font-semibold ${balances[tx.id] >= 0 ? 'text-slate-700' : 'text-rose-600'} whitespace-nowrap">${fmtMoney(balances[tx.id] || 0)}</td>
      <td class="text-right whitespace-nowrap">
        <button class="row-btn bg-brand-50 text-brand-600 hover:bg-brand-100" onclick="showReceipt('${tx.id}')"><i class="fa-solid fa-receipt"></i></button>
        <button class="row-btn bg-slate-100 text-slate-600 hover:bg-slate-200" onclick="openTxnModal(null, '${tx.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="row-btn bg-rose-50 text-rose-600 hover:bg-rose-100" onclick="deleteTxn('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  $('txnEmpty').classList.toggle('hidden', list.length > 0);
$('finFilteredIncome').textContent = fmtMoney(list.filter(t => t.type === 'income').reduce((s, t) => s + (month ? txnAmountInMonth(t, month) : (+t.amount || 0)), 0));
$('finFilteredExpense').textContent = fmtMoney(list.filter(t => t.type === 'expense').reduce((s, t) => s + (month ? txnAmountInMonth(t, month) : (+t.amount || 0)), 0));
  $('txnCountLine').textContent = `${fmtNum(list.length)} ${t('entries')}`;
}
/* One-click sports quick filter (matches খেলা / ক্রীড়া in description or vendor) */
function isSportsTxn(tx) {
   const s = ((tx.description || '') + ' ' + (tx.vendor || '')).toLowerCase();
   return s.includes('খেলা') || s.includes('ক্রীড়া');
}

function syncSportsChip() {
   const btn = document.getElementById('sportsFilterBtn');
   if (!btn) return;
   btn.innerHTML = '<i class="fa-solid fa-trophy"></i> ' + t('sportsFilter');
   btn.className = finSportsOnly
     ? 'text-xs font-bold px-3 py-1.5 rounded-full bg-brand-700 text-white transition'
      : 'text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
}

function ensureSportsChip() {
   let btn = document.getElementById('sportsFilterBtn');
   if (!btn) {
      const tabs = document.querySelectorAll('.ftab');
      if (!tabs.length) return;
      btn = document.createElement('button');
      btn.id = 'sportsFilterBtn';
      btn.type = 'button';
      btn.addEventListener('click', () => {
         finSportsOnly = !finSportsOnly;
         syncSportsChip();
         renderFinance();
      });
      tabs[tabs.length - 1].after(btn);
   }
   syncSportsChip();
}
   
/* ── Transaction modal ──────────────────────────────────── */
function buildTxnCategoryOptions(type) {
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  $('tCategory').innerHTML = cats.map(c => `<option value="${c}">${catName(c)}</option>`).join('');
  toggleTxnMemberField();
}
function toggleTxnMemberField() {
  const show = $('tType').value === 'income' && $('tCategory').value === 'subscription';
  $('tMemberWrap').classList.toggle('hidden', !show);
   $('tMonthsWrap').classList.toggle('hidden', !show);
  $('tVendorWrap').classList.toggle('hidden', show);
  if (show) {
    $('tMember').innerHTML = db.members.filter(m => m.status === 'active')
      .map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.memberId)})</option>`).join('');
     buildMonthsChecklist();
  }
}
function pickedMonths() {
  return [...document.querySelectorAll('#tMonthsList .mrow input[type=checkbox]:checked')]
    .map(c => ({ m: c.value, a: Math.abs(+c.closest('.mrow').querySelector('.mamt').value || 0) }))
    .sort((x, y) => x.m < y.m ? -1 : 1);
}
function syncMonthsHint() {
  const ms = pickedMonths();
  const sum = ms.reduce((s, x) => s + x.a, 0);
  $('tMonthsHint').textContent = ms.length
    ? fmtNum(ms.length) + ' ' + t('monthsPicked') + ' · ' + monthsLabel(ms.map(x => x.m)) + ' · ' + fmtMoney(sum)
    : t('errPickMonth');
  if (ms.length) { $('tAmount').value = sum; }
}
function buildMonthsChecklist(checked) {
  const list = $('tMonthsList');
  const pre = checked || [{ m: currentMonthKey() }];
  const preMap = {};
  pre.forEach(x => {
    const k = typeof x === 'string' ? x : x.m;
    if (k) preMap[k] = (x && typeof x === 'object' && +x.a) ? +x.a : null;
  });
  const sel = db.members.find(x => x.id === $('tMember').value);
  const fee = sel ? memberMonthlyFee(sel) : 200;
  const [cy, cm] = currentMonthKey().split('-').map(Number);
  const endKey = (() => {
    const d = new Date(cy, cm + 11, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();
  let html = '';
  let k = '2026-09';
  while (k <= endKey) {
    const [y, m] = k.split('-').map(Number);
    const on = Object.prototype.hasOwnProperty.call(preMap, k);
    const amt = preMap[k] != null ? preMap[k] : (on ? fee : '');
    html += '<label class="mrow flex items-center gap-2 py-2"><input type="checkbox" class="shrink-0" value="' + k + '"' + (on ? ' checked' : '') + ' onchange="onMonthRowChange(this)"><span class="flex-1 whitespace-nowrap">' + monthFullLabel(k) + '</span><input type="number" class="mamt input w-24 shrink-0" min="1" value="' + amt + '" onchange="syncMonthsHint()"></label>';
    const d = new Date(y, m, 1);
    k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  list.innerHTML = html;
  syncMonthsHint();
}
function onMonthRowChange(cb) {
  if (cb.checked) {
    const amt = cb.closest('.mrow').querySelector('.mamt');
    if (amt && !+amt.value) {
      const m = db.members.find(x => x.id === $('tMember').value);
      if (m) amt.value = memberMonthlyFee(m);
    }
  }
  syncMonthsHint();
}
let currentReceiptTx = null;
function showReceipt(id) {
  const tx = db.transactions.find(x => x.id === id);
  if (!tx) return;
  currentReceiptTx = tx;
  const m = tx.memberId ? db.members.find(x => x.id === tx.memberId) : null;
  const months = tx.category === 'subscription' ? txnMonths(tx) : [];
  $('receiptBody').innerHTML =
    '<div class="text-center mb-4"><p class="font-bold text-lg">' + esc(currentLang === 'bn' ? db.settings.orgName : (db.settings.orgNameEn || db.settings.orgName)) + '</p>'
    + '<p class="text-xs text-slate-500">' + esc(db.settings.orgAddress || '') + '</p></div>'
    + '<div class="space-y-2 text-sm">'
    + '<div class="flex justify-between border-b pb-2"><span class="text-slate-500">' + t('fMember') + '</span><span class="font-semibold">' + esc(m ? m.name + ' (' + m.memberId + ')' : '-') + '</span></div>'
    + (months.length ? '<div class="border-b pb-2"><p class="text-slate-500 mb-1">' + t('monthsCovered') + '</p>' + months.map(k => '<div class="flex justify-between"><span>• ' + monthFullLabel(k) + '</span><span class="font-semibold">' + fmtMoney(txnMonthAmount(tx, k)) + '</span></div>').join('') + '</div>' : '')
    + '<div class="flex justify-between border-b pb-2"><span class="text-slate-500">' + t('fAmount') + '</span><span class="font-bold text-brand-700">' + fmtMoney(tx.amount) + '</span></div>'
    + '<div class="flex justify-between"><span class="text-slate-500">' + t('fDate') + '</span><span class="font-semibold">' + fmtDate(tx.date) + '</span></div>'
    + '</div>';
  openModal('receiptModal');
}
function printReceipt() {
  if (!currentReceiptTx) return;
  const area = $('print-area');
  area.innerHTML = '<div style="padding:16px">' + $('receiptBody').innerHTML + '</div>';
  setTimeout(() => window.print(), 350);
}
function setTxnType(type) {
  $('tType').value = type;
  $('tTypeIncome').className = 'ttype-btn' + (type === 'income' ? ' active-income' : '');
  $('tTypeExpense').className = 'ttype-btn' + (type === 'expense' ? ' active-expense' : '');
  if (!$('tEditId').value) $('txnModalTitle').textContent = type === 'income' ? t('txnTitleIncome') : t('txnTitleExpense');
  buildTxnCategoryOptions(type);
}

function openTxnModal(type, editId, prefill) {
  $('txnForm').reset();
  $('tEditId').value = editId || '';

  if (editId) {
    const tx = db.transactions.find(x => x.id === editId);
    if (!tx) return;
    $('txnModalTitle').textContent = t('editTxn');
    setTxnType(tx.type);
    $('tCategory').value = tx.category;
    toggleTxnMemberField();
    $('tDate').value = tx.date;
     if (tx.category === 'subscription') buildMonthsChecklist(tx.months && tx.months.length ? tx.months : [{m: monthKeyOf(tx.date)}]);
    $('tAmount').value = tx.amount;
    $('tDesc').value = tx.description || '';
    $('tVendor').value = tx.vendor || '';
    if (tx.memberId) $('tMember').value = tx.memberId;
  } else {
    setTxnType(type || 'income');
    $('tDate').value = todayISO();
    if (prefill) {
      if (prefill.category) { $('tCategory').value = prefill.category; toggleTxnMemberField(); }
      if (prefill.amount) $('tAmount').value = prefill.amount;
      if (prefill.date) $('tDate').value = prefill.date;
       if (prefill.date) buildMonthsChecklist([{m: monthKeyOf(prefill.date)}]);
      if (prefill.description) $('tDesc').value = prefill.description;
      if (prefill.vendor) $('tVendor').value = prefill.vendor;
    }
  }
  openModal('txnModal');
}

function saveTxn(e) {
  e.preventDefault();
  const editId = $('tEditId').value;
  const type = $('tType').value;
  const category = $('tCategory').value;
  const isSub = type === 'income' && category === 'subscription';
  const memberId = isSub ? $('tMember').value : '';
   const months = isSub ? pickedMonths() : [];
   
  if (isSub && !months.length) { showToast(t('errPickMonth'), 'error'); return; }
if (isSub && months.some(x => !x.a)) { showToast(t('enterAmount'), 'error'); return; }
let desc = $('tDesc').value.trim();
  if (!desc) {
    if (isSub && memberId) {
      const m = db.members.find(x => x.id === memberId);
const keys = months.map(x => x.m);
const sameAmt = months.length && months.every(x => x.a === months[0].a);
const suffix = sameAmt ? fmtNum(months.length) + ' মাস × ' + fmtMoney(months[0].a) : fmtNum(months.length) + ' মাস, ' + months.map(x => fmtNum(x.a)).join('+');
const suffixEn = sameAmt ? fmtNum(months.length) + ' months × ' + fmtMoney(months[0].a) : fmtNum(months.length) + ' months, ' + months.map(x => fmtNum(x.a)).join('+');
      desc = m ? (currentLang === 'bn' ? `${m.name} এর মাসিক চাঁদা (${monthsLabel(keys)}) • ${suffix}` : `${m.name}'s monthly subscription (${monthsLabel(keys)}) • ${suffixEn}`) : catName(category);
    } else desc = catName(category);
  }

  const data = {
    date: ($('tDate').value || todayISO()),
    type, category,
    amount: isSub ? months.reduce((s, x) => s + x.a, 0) : Math.abs(+$('tAmount').value || 0),
    description: desc,
    vendor: isSub ? '' : $('tVendor').value.trim(),
    memberId
  };
  if (isSub) data.months = months;
if (!data.amount) { showToast(t('enterAmount'), 'error'); return; }

  if (editId) {
    Object.assign(db.transactions.find(x => x.id === editId), data);
if (!isSub) delete db.transactions.find(x => x.id === editId).months;
    showToast(t('txnUpdated'));
  } else {
    db.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
    showToast(t('txnAdded'));
  }
  if (window.OTWCloudLogActivity) window.OTWCloudLogActivity(editId ? 'txn_edit' : 'txn_add', desc, fmtMoney(data.amount) + ' • ' + data.date);
  recomputeAllLastPaid();
  saveDB();
  closeModal('txnModal');
  refreshAll();
}

function deleteTxn(id) {
  const tx = db.transactions.find(x => x.id === id);
  confirmAction(t('confirmDelete'), () => {
    if (window.OTWCloudLogActivity && tx) window.OTWCloudLogActivity('txn_delete', tx.description || '', fmtMoney(tx.amount) + ' • ' + (tx.date || ''));
    db.transactions = db.transactions.filter(x => x.id !== id);
  recomputeAllLastPaid();
    saveDB();
    showToast(t('txnDeleted'));
    refreshAll();
  });
}
