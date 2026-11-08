/* ════════════════════════════════════════════════════════════
   OTW — Main application controller
   Routing, dashboard, modals, settings, backup & init
   ════════════════════════════════════════════════════════════ */

let currentPage = 'dashboard';
const PAGE_TITLES = {
  dashboard: 'navDashboard', members: 'navMembers', dues: 'navDues', activity: 'navActivity', finance: 'cashBook',
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
  else if (currentPage === 'dues') renderDues();   
  else if (currentPage === 'activity') renderActivity();
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

  $('statIncome').textContent = fmtMoney(inc);
  $('statIncomeSub').textContent = `${t('thisMonth')}: ${fmtMoney(mt.income)}`;
  $('statExpense').textContent = fmtMoney(exp);
  $('statExpenseSub').textContent = `${t('thisMonth')}: ${fmtMoney(mt.expense)}`;
  $('statBalance').textContent = fmtMoney(bal);
  $('statBalanceSub').textContent = bal >= 0 ? t('surplus') : t('deficit');
  $('statPending').textContent = fmtMoney(pend.reduce((s, m) => s + memberMonthlyFee(m), 0));
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
        <p class="text-xs text-slate-500">${esc(num(m.memberId))}</p>
      </div>
    </div>`).join('')
    : `<div class="text-center py-8 text-slate-400 text-sm"><i class="fa-solid fa-circle-check text-3xl text-brand-500 block mb-2"></i>${t('noPending')}</div>`;
  renderNotices();
}

/* ── Dues page ─────────────────────────────────────────── */
let duesFilter = 'all';
function renderDues() {
  if (!$('duesFilterChips') || !$('duesList')) return;
  $('duesFilterChips').innerHTML = ['all', 500, 200, 100].map(f => `<button class="ftab${String(f) === String(duesFilter) ? ' active' : ''}" onclick="setDuesFilter('${f}')">${f === 'all' ? t('duesAll') : fmtMoney(f)}</button>`).join('');
  const pend = pendingMembers();
  const list = duesFilter === 'all' ? pend : pend.filter(m => memberMonthlyFee(m) === +duesFilter);
  $('duesCount').textContent = `${fmtNum(list.length)} ${t('membersWord')}`;
  $('duesList').innerHTML = list.length ? list.map(m => `
    <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div class="min-w-0"><p class="font-medium text-slate-800 truncate">${esc(m.name)}</p>
      <p class="text-xs text-slate-500">${esc(num(m.memberId))}</p></div>
    </div>`).join('') : `<p class="py-6 text-center text-slate-400 text-sm">${t('noData')}</p>`;
}
/* ── Notice board ───────────────────────────────────────── */
let editingNoticeId = null;
function renderNotices() {
  const listEl = $('noticesList'), formEl = $('noticeFormWrap');
  if (!listEl) return;
  const notices = (db.notices || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  if (formEl) {
    formEl.innerHTML = `
      <form onsubmit="saveNotice(event)" class="space-y-3 mb-5">
        <input id="nTitle" type="text" class="input" placeholder="${esc(t('noticeTitlePh'))}" required>
        <textarea id="nBody" rows="3" class="input" placeholder="${esc(t('noticeBodyPh'))}"></textarea>
        <div class="flex items-center gap-2">
          <button type="submit" class="btn-primary !py-2"><i class="fa-solid fa-plus"></i> ${esc(editingNoticeId ? t('save') : t('addNotice'))}</button>
          ${editingNoticeId ? `<button type="button" class="btn-secondary !py-2" onclick="cancelNoticeEdit()">${esc(t('cancel'))}</button>` : ''}
        </div>
      </form>`;
  }
    if (!notices.length) {
         listEl.innerHTML = `<p class="py-6 text-center text-slate-400 text-sm">${t('noNotices')}</p>`;
       return;
    }
   const [top, ...rest] = notices;
   const editBtns = (n) => `
     <div class="flex gap-1 shrink-0">
       <button class="icon-btn" onclick="editNotice('${n.id}')"><i class="fa-solid fa-pen"></i></button>
       <button class="icon-btn" onclick="deleteNotice('${n.id}')"><i class="fa-solid fa-trash text-rose-500"></i></button>
   </div>`;listEl.innerHTML = `
     <article class="rounded-2xl border-l-4 border-rose-600 bg-rose-50/50 px-4 py-4 mb-2">
       <div class="flex items-center gap-2 mb-2">
         <span class="text-[11px] font-bold uppercase tracking-wide bg-rose-600 text-white rounded px-2 py-0.5">${esc(t('latestBadge'))}</span>
         <span class="text-xs text-slate-400">${fmtDate(top.date)}</span>
         <span class="ml-auto">${editBtns(top)}</span>
   </div>
     <h4 class="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">${esc(top.title)}</h4>
     ${top.body ? `<p class="text-sm sm:text-base text-slate-700 mt-2 whitespace-pre-line">${esc(top.body)}</p>` : ''}
</article>
${rest.map(n => `
  <div class="flex items-start gap-3 py-3 border-t border-slate-100">
    <span class="mt-2 w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
    <div class="min-w-0 flex-1">
      <p class="font-bold text-slate-800 leading-snug">${esc(n.title)}</p>
      <p class="text-xs text-slate-400 mt-0.5">${fmtDate(n.date)}</p>
      ${n.body ? `<p class="text-sm text-slate-600 mt-1 whitespace-pre-line">${esc(n.body)}</p>` : ''}
</div>
${editBtns(n)} </div>`).join('')}`;
}

function saveNotice(e) {
  e.preventDefault();
  const title = $('nTitle').value.trim();
  if (!title) return;
  const body = $('nBody').value.trim();
  if (!Array.isArray(db.notices)) db.notices = [];
  if (editingNoticeId) {
    const n = db.notices.find(x => x.id === editingNoticeId);
    if (n) { n.title = title; n.body = body; }
    if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('notice_edit', title, '');
    showToast(t('noticeUpdated'));
    editingNoticeId = null;
  } else {
    db.notices.push({ id: uid(), title, body, date: todayISO() });
    if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('notice_add', title, '');
    showToast(t('noticeAdded'));
  }
  saveDB();
  renderNotices();
}
function editNotice(id) {
  const n = (db.notices || []).find(x => x.id === id);
  if (!n) return;
  editingNoticeId = id;
  renderNotices();
  $('nTitle').value = n.title;
  $('nBody').value = n.body || '';
  $('nTitle').focus();
}
function cancelNoticeEdit() { editingNoticeId = null; renderNotices(); }
function deleteNotice(id) {
  const n = (db.notices || []).find(x => x.id === id);
  confirmAction(t('confirmDelete'), () => {
    db.notices = (db.notices || []).filter(x => x.id !== id);
    if (window.OTWCloudLogActivity && n) window.OTWCloudLogActivity('notice_delete', n.title, '');
    saveDB();
    showToast(t('noticeDeleted'));
    renderNotices();
  });
}

function setDuesFilter(f) { duesFilter = f; renderDues(); }

/* ── Activity timeline ──────────────────────────────────── */ const ACTIVITY_LABELS = { txn_add: 'txnAdded', txn_edit: 'txnUpdated', txn_delete: 'txnDeleted',   notice_add: 'noticeAdded',   notice_edit: 'noticeUpdated',   notice_delete: 'noticeDeleted', member_add: 'memberAdded', member_edit: 'memberUpdated', member_delete: 'memberDeleted', member_status: 'actStatus', settings_save: 'saved', backup_import: 'backupImported', data_clear: 'dataCleared', demo_load: 'demoLoaded' }; function renderActivity() { const el = $('activityList'); if (!el) return; el.innerHTML = '<p class="py-6 text-center text-slate-400 text-sm">...</p>'; if (!window.OTWCloudLoadActivity) { el.innerHTML = '<p class="py-6 text-center text-slate-400 text-sm">' + t('noData') + '</p>'; return; } window.OTWCloudLoadActivity(function (items, err) { if (err || !items) { el.innerHTML = '<p class="py-6 text-center text-slate-400 text-sm">' + t('errGeneric') + '</p>'; return; } el.innerHTML = items.length ? items.map(function (a) { return '<div class="flex gap-3 py-3 border-b border-slate-100 last:border-0">' + '<div class="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><i class="fa-solid fa-clock-rotate-left"></i></div>' + '<div class="min-w-0 flex-1"><p class="text-sm text-slate-800"><span class="font-semibold">' + esc(t(ACTIVITY_LABELS[a.action] || 'saved')) + '</span> — ' + esc(a.target || '') + (a.details ? ' <span class="text-slate-500">(' + esc(a.details) + ')</span>' : '') + '</p>' + '<p class="text-xs text-slate-400 mt-0.5">' + esc(a.email || '') + ' • ' + esc(a.role || '') + ' • ' + esc(fmtDate((a.at || '').slice(0, 10))) + ' ' + esc((a.at || '').slice(11, 16)) + '</p></div></div>'; }).join('') : '<p class="py-6 text-center text-slate-400 text-sm">' + t('noData') + '</p>'; }); } /* ── Sidebar / header ───────────────────────────────────── */
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
  db.settings.monthlyFee = Math.max(0, +$('setMonthlyFee').value || 0); saveDB(); if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('settings_save', db.settings.orgName || '', fmtMoney(db.settings.monthlyFee));
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
      if (!Array.isArray(db.notices)) db.notices = [];
      saveDB();
      currentLang = db.settings.lang === 'en' ? 'en' : 'bn';
      setLang(currentLang);
      showToast(t('backupImported')); if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('backup_import', '', parsed.members.length + ' members, ' + parsed.transactions.length + ' entries');
    } catch (err) { showToast(t('backupInvalid'), 'error'); }
  };
  reader.readAsText(file);
}
function loadDemoData() {
  confirmAction(t('confirmDemo'), () => {
    const lang = currentLang;
    db = seedData();
    db.settings.lang = lang; saveDB(); if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('demo_load', '', '');
    setLang(lang);
    showToast(t('demoLoaded'));
  }, t('yes'));
}
function clearAllData() {
  confirmAction(t('confirmClear'), () => {
    if (window.OTWCloudLogActivity) window.OTWCloudLogActivity('data_clear', '', ''); db.members = [];
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
