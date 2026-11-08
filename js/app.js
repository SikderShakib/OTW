/* ════════════════════════════════════════════════════════════
   OTW — Main application controller
   Routing, dashboard, modals, settings, backup & init
   ════════════════════════════════════════════════════════════ */

let currentPage = 'dashboard';
const PAGE_TITLES = {
  dashboard: 'navDashboard', members: 'navMembers', finance: 'cashBook',
  scanner: 'navScanner', reports: 'navReports', settings: 'navSettings',
  myprofile: 'myProfile'
};

/* ── Router ─────────────────────────────────────────────── */
function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(s => s.classList.add('hidden'));
  $('page-' + page).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.page === page));
  $('pageTitle').textContent = t(PAGE_TITLES[page]);
  closeSidebarMobile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderCurrentPage();
}
function renderCurrentPage() {
  if (currentPage === 'dashboard') renderDashboard();
  else if (currentPage === 'members') renderMembers();
  else if (currentPage === 'finance') renderFinance();
  else if (currentPage === 'reports') renderReports();
  else if (currentPage === 'settings') fillSettings();
  else if (currentPage === 'myprofile' && window.OTWCloud && window.OTWCloud.rerenderMember) window.OTWCloud.rerenderMember();
}
function refreshAll() { updateSidebarStats(); renderCurrentPage(); }

/* ── Dashboard ──────────────────────────────────────────── */
function renderDashboard() {
  const inc = totalIncome(), exp = totalExpense(), bal = inc - exp;
  const mt = monthTotals(currentMonthKey());
  const pend = pendingMembers();
  const fee = +db.settings.monthlyFee || 0;

  $('statIncome').textContent = fmtMoney(inc);
  $('statIncomeSub').textContent = `${t('thisMonth')}: ${fmtMoney(mt.income)}`;
  $('statExpense').textContent = fmtMoney(exp);
  $('statExpenseSub').textContent = `${t('thisMonth')}: ${fmtMoney(mt.expense)}`;
  $('statBalance').textContent = fmtMoney(bal);
  $('statBalanceSub').textContent = bal >= 0 ? t('surplus') : t('deficit');
  $('statPending').textContent = fmtMoney(pend.length * fee);
  $('statPendingSub').textContent = `${fmtNum(pend.length)} ${t('membersWord')} • ${monthFullLabel(currentMonthKey())}`;

  renderDashboardCharts();

  /* Recent transactions */
  const recent = sortedTxns().slice(-7).reverse();
  $('recentTxnList').innerHTML = recent.length ? recent.map(tx => {
    const isInc = tx.type === 'income';
    return `<div class="flex items-center gap-3 py-3">
      <span class="w-10 h-10 rounded-xl ${isInc ? 'bg-brand-50 text-brand-600' : 'bg-rose-50 text-rose-500'} flex items-center justify-center shrink-0">
        <i class="fa-solid ${isInc ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-medium text-slate-800 truncate">${esc(tx.description || catName(tx.category))}</p>
        <p class="text-xs text-slate-400">${fmtDate(tx.date)} • ${catName(tx.category)}</p>
      </div>
      <p class="font-bold ${isInc ? 'text-brand-700' : 'text-rose-600'} whitespace-nowrap">${isInc ? '+' : '−'}${fmtMoney(tx.amount)}</p>
    </div>`;
  }).join('') : `<p class="py-10 text-center text-slate-400 text-sm">${t('noData')}</p>`;

  /* Pending members */
  const activeCount = db.members.filter(m => m.status === 'active').length;
  $('memberSummaryLine').textContent =
    `${t('totalMembers')}: ${fmtNum(db.members.length)} • ${fmtNum(activeCount)} ${t('activeMembers')}`;
  $('pendingList').innerHTML = pend.length ? pend.slice(0, 6).map(m => `
    <div class="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
      ${avatarHTML(m)}
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-sm text-slate-800 truncate">${esc(m.name)}</p>
        <p class="text-xs text-slate-500">${esc(num(m.memberId))} • ${fmtMoney(fee)}</p>
      </div>
    </div>`).join('')
    : `<div class="text-center py-8 text-slate-400 text-sm"><i class="fa-solid fa-circle-check text-3xl text-brand-500 block mb-2"></i>${t('noPending')}</div>`;
}

/* ── Sidebar / header ───────────────────────────────────── */
function updateSidebarStats() {
  $('sidebarBalance').textContent = fmtMoney(currentBalance());
  $('sidebarBalanceSub').textContent =
    `${fmtNum(db.members.length)} ${t('membersWord')} • ${fmtNum(db.transactions.length)} ${t('entries')}`;
  $('navMemberCount').textContent = fmtNum(db.members.length);
  $('footerYear').textContent = num(new Date().getFullYear());
}
function updateHeaderDate() {
  $('headerDate').textContent = new Date().toLocaleDateString(
    currentLang === 'bn' ? 'bn-BD' : 'en-GB',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function applyOrgBranding() {
  const name = currentLang === 'bn' ? db.settings.orgName : (db.settings.orgNameEn || db.settings.orgName);
  document.querySelectorAll('.org-name').forEach(el => el.textContent = name);
  document.title = `OTW — ${t('appTagline')}`;
}

/* ── Modals, toast, confirm ─────────────────────────────── */
function openModal(id) { $(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { $(id).classList.remove('open'); document.body.style.overflow = ''; }

let toastTimer = null;
function showToast(msg, type = 'success') {
  $('toastMsg').textContent = msg;
  $('toastIcon').className = type === 'error'
    ? 'fa-solid fa-circle-exclamation text-rose-400'
    : 'fa-solid fa-circle-check text-brand-400';
  $('toast').classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 2800);
}

let confirmCallback = null;
function confirmAction(msg, cb, yesLabel) {
  $('confirmMsg').textContent = msg;
  $('confirmYes').querySelector('span').textContent = yesLabel || t('yesDelete');
  confirmCallback = cb;
  openModal('confirmModal');
}

/* ── Settings & data management ─────────────────────────── */
function fillSettings() {
  $('setOrgName').value = db.settings.orgName || '';
  $('setOrgNameEn').value = db.settings.orgNameEn || '';
  $('setOrgAddress').value = db.settings.orgAddress || '';
  $('setMonthlyFee').value = db.settings.monthlyFee || 0;
  $('setLang').value = currentLang;
  if (window.OTWCloud && window.OTWCloud.renderSettingsCard) {
    try { window.OTWCloud.renderSettingsCard(); } catch (e) {}
  }
}
function saveSettings() {
  db.settings.orgName = $('setOrgName').value.trim() || db.settings.orgName;
  db.settings.orgNameEn = $('setOrgNameEn').value.trim();
  db.settings.orgAddress = $('setOrgAddress').value.trim();
  db.settings.monthlyFee = Math.max(0, +$('setMonthlyFee').value || 0);
  saveDB();
  applyOrgBranding();
  showToast(t('saved'));
  refreshAll();
  const wanted = $('setLang').value;
  if (wanted !== currentLang) setLang(wanted);
}
function exportBackup() {
  downloadBlob(JSON.stringify(db, null, 2), `OTW-Backup-${todayISO()}.json`, 'application/json');
  showToast(t('backupExported'));
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !parsed.settings || !Array.isArray(parsed.members) || !Array.isArray(parsed.transactions)) throw 0;
      db = parsed;
      saveDB();
      currentLang = db.settings.lang === 'en' ? 'en' : 'bn';
      setLang(currentLang);
      showToast(t('backupImported'));
    } catch (err) { showToast(t('backupInvalid'), 'error'); }
  };
  reader.readAsText(file);
}
function loadDemoData() {
  confirmAction(t('confirmDemo'), () => {
    const lang = currentLang;
    db = seedData();
    db.settings.lang = lang;
    saveDB();
    setLang(lang);
    showToast(t('demoLoaded'));
  }, t('yes'));
}
function clearAllData() {
  confirmAction(t('confirmClear'), () => {
    db.members = [];
    db.transactions = [];
    saveDB();
    refreshAll();
    showToast(t('dataCleared'));
  });
}

/* ── Selects that depend on language ────────────────────── */
function buildStaticSelects() {
  const roleSel = $('memberRoleFilter');
  const roleVal = roleSel.value;
  roleSel.innerHTML = `<option value="">${t('allRoles')}</option>` +
    ROLES.map(r => `<option value="${r}">${roleName(r)}</option>`).join('');
  roleSel.value = roleVal;

  const catSel = $('finCategoryFilter');
  const catVal = catSel.value;
  catSel.innerHTML = `<option value="">${t('allCategories')}</option>` +
    `<optgroup label="${t('income')}">${INCOME_CATEGORIES.map(c => `<option value="${c}">${catName(c)}</option>`).join('')}</optgroup>` +
    `<optgroup label="${t('expense')}">${EXPENSE_CATEGORIES.map(c => `<option value="${c}">${catName(c)}</option>`).join('')}</optgroup>`;
  catSel.value = catVal;

  $('scanCategory').innerHTML = EXPENSE_CATEGORIES.map(c => `<option value="${c}">${catName(c)}</option>`).join('');
}

/* ── Mobile sidebar ─────────────────────────────────────── */
function closeSidebarMobile() {
  $('sidebar').classList.add('-translate-x-full');
  $('sidebarOverlay').classList.add('hidden');
}

/* ── Init ───────────────────────────────────────────────── */
function init() {
  currentLang = db.settings.lang === 'en' ? 'en' : 'bn';

  /* Cloud boot safety: if the cloud layer hasn't resolved within 10s
     (e.g. SDK unreachable), fall back to local mode instead of a stuck loader. */
  setTimeout(function () {
    if (document.documentElement.classList.contains('otw-cloud-wait') && !window.__otwCloudReady) {
      document.documentElement.classList.remove('otw-cloud-wait');
    }
  }, 10000);

  /* Nav */
  document.querySelectorAll('.nav-item').forEach(n =>
    n.addEventListener('click', () => showPage(n.dataset.page)));
  $('menuBtn').addEventListener('click', () => {
    $('sidebar').classList.remove('-translate-x-full');
    $('sidebarOverlay').classList.remove('hidden');
  });
  $('sidebarOverlay').addEventListener('click', closeSidebarMobile);

  /* Language */
  $('langBn').addEventListener('click', () => setLang('bn'));
  $('langEn').addEventListener('click', () => setLang('en'));

  /* Members */
  $('memberSearch').addEventListener('input', renderMembers);
  $('memberRoleFilter').addEventListener('change', renderMembers);
  $('memberStatusFilter').addEventListener('change', renderMembers);
  $('memberForm').addEventListener('submit', saveMember);
  $('mPhotoInput').addEventListener('change', async e => {
    if (!e.target.files[0]) return;
    memberPhotoData = await readImageFile(e.target.files[0], 320);
    $('mPhotoPreview').innerHTML = `<img src="${memberPhotoData}" class="w-full h-full object-cover" alt="">`;
  });

  /* Finance */
  document.querySelectorAll('.ftab').forEach(b => b.addEventListener('click', () => {
    finTypeFilter = b.dataset.ftype;
    document.querySelectorAll('.ftab').forEach(x => x.classList.toggle('active', x === b));
    renderFinance();
  }));
  document.querySelector('.ftab[data-ftype="all"]').classList.add('active');
  $('finSearch').addEventListener('input', renderFinance);
  $('finCategoryFilter').addEventListener('change', renderFinance);
  $('finMonthFilter').addEventListener('change', renderFinance);
  $('txnForm').addEventListener('submit', saveTxn);
  $('tCategory').addEventListener('change', toggleTxnMemberField);

  /* Reports */
  $('reportYear').addEventListener('change', renderReports);

  /* Settings */
  $('importInput').addEventListener('change', e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ''; });

  /* Modals: backdrop + close buttons + Esc */
  document.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => closeModal(el.dataset.close)));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(m => closeModal(m.id));
  });
  $('confirmYes').addEventListener('click', () => {
    closeModal('confirmModal');
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });

  initScanner();

  /* First paint */
  applyI18n();
  applyOrgBranding();
  buildStaticSelects();
  updateSidebarStats();
  updateHeaderDate();
  showPage('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
