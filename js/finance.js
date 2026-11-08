/* ════════════════════════════════════════════════════════════
   OTW — Financial Management & Cash Book (জমা-খরচ)
   ════════════════════════════════════════════════════════════ */

let finTypeFilter = 'all';
let finSportsOnly = false;


function monthTotals(monthKey) {
  const list = db.transactions.filter(t => monthKeyOf(t.date) === monthKey);
  return { income: totalIncome(list), expense: totalExpense(list) };
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
    if (month && monthKeyOf(tx.date) !== month) return false;
     if (finSportsOnly && !isSportsTxn(tx)) return false;
    if (q && !((tx.description || '').toLowerCase().includes(q) || (tx.vendor || '').toLowerCase().includes(q))) return false;
    return true;
  }).reverse(); // newest first

  $('txnTableBody').innerHTML = list.map(tx => {
    const isInc = tx.type === 'income';
    const member = tx.memberId ? db.members.find(m => m.id === tx.memberId) : null;
    const sub = [tx.vendor, member ? member.name : ''].filter(Boolean).join(' • ');
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
      <td class="text-right font-semibold text-brand-700 whitespace-nowrap">${isInc ? fmtMoney(tx.amount) : '<span class="text-slate-300">—</span>'}</td>
      <td class="text-right font-semibold text-rose-600 whitespace-nowrap">${!isInc ? fmtMoney(tx.amount) : '<span class="text-slate-300">—</span>'}</td>
      <td class="text-right font-semibold ${balances[tx.id] >= 0 ? 'text-slate-700' : 'text-rose-600'} whitespace-nowrap">${fmtMoney(balances[tx.id] || 0)}</td>
      <td class="text-right whitespace-nowrap">
        <button class="row-btn bg-slate-100 text-slate-600 hover:bg-slate-200" onclick="openTxnModal(null, '${tx.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="row-btn bg-rose-50 text-rose-600 hover:bg-rose-100" onclick="deleteTxn('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  $('txnEmpty').classList.toggle('hidden', list.length > 0);
  $('finFilteredIncome').textContent = fmtMoney(totalIncome(list));
  $('finFilteredExpense').textContent = fmtMoney(totalExpense(list));
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
  $('tVendorWrap').classList.toggle('hidden', show);
  if (show) {
    $('tMember').innerHTML = db.members.filter(m => m.status === 'active')
      .map(m => `<option value="${m.id}">${esc(m.name)} (${esc(m.memberId)})</option>`).join('');
  }
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
  let desc = $('tDesc').value.trim();
  if (!desc) {
    if (isSub && memberId) {
      const m = db.members.find(x => x.id === memberId);
      desc = m ? (currentLang === 'bn' ? `${m.name} এর মাসিক চাঁদা` : `${m.name}'s monthly subscription`) : catName(category);
    } else desc = catName(category);
  }

  const data = {
    date: $('tDate').value || todayISO(),
    type, category,
    amount: Math.abs(+$('tAmount').value || 0),
    description: desc,
    vendor: isSub ? '' : $('tVendor').value.trim(),
    memberId
  };
  if (!data.amount) { showToast(t('enterAmount'), 'error'); return; }

  if (editId) {
    Object.assign(db.transactions.find(x => x.id === editId), data);
    showToast(t('txnUpdated'));
  } else {
    db.transactions.push({ id: uid(), createdAt: Date.now(), ...data });
    showToast(t('txnAdded'));
  }
  recomputeAllLastPaid();
  saveDB();
  closeModal('txnModal');
  refreshAll();
}

function deleteTxn(id) {
  confirmAction(t('confirmDelete'), () => {
    db.transactions = db.transactions.filter(x => x.id !== id);
    recomputeAllLastPaid();
    saveDB();
    showToast(t('txnDeleted'));
    refreshAll();
  });
}
