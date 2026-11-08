/* ════════════════════════════════════════════════════════════
   OTW — Member Directory & Digital ID Card
   ════════════════════════════════════════════════════════════ */

let memberPhotoData = '';
let currentCardMember = null;

function renderMembers() {
  const q = ($('memberSearch').value || '').trim().toLowerCase();
  const role = $('memberRoleFilter').value;
  const status = $('memberStatusFilter').value;

  const list = db.members.filter(m => {
    if (role && m.designation !== role) return false;
    if (status && m.status !== status) return false;
    if (q && !(m.name.toLowerCase().includes(q) || m.memberId.toLowerCase().includes(q) || m.phone.includes(q))) return false;
    return true;
  });

  const tbody = $('membersTableBody');
  tbody.innerHTML = list.map(m => {
    const paid = isPaidThisMonth(m);
    return `<tr>
      <td>
        <div class="flex items-center gap-3">
          ${avatarHTML(m)}
          <div class="min-w-0">
            <p class="font-semibold text-slate-800 truncate">${esc(m.name)}</p>
            <p class="text-xs text-slate-400">${esc(num(m.memberId))}</p>
          </div>
        </div>
      </td>
      <td><span class="chip">${roleName(m.designation)}</span></td>
      <td class="whitespace-nowrap">${num(m.phone)}</td>
      <td class="whitespace-nowrap text-slate-600">${fmtDate(m.joinDate)}</td>
      <td>${m.status === 'active'
        ? (paid ? `<span class="pill pill-green"><i class="fa-solid fa-check"></i>${t('paid')}</span>`
                : `<span class="pill pill-amber"><i class="fa-solid fa-clock"></i>${t('due')}</span>`)
        : '<span class="text-slate-400">—</span>'}</td>
      <td>${m.status === 'active'
        ? `<span class="pill pill-green">${t('statusActive')}</span>`
        : `<span class="pill pill-red">${t('statusInactive')}</span>`}</td>
      <td class="text-right whitespace-nowrap">
        <button class="row-btn bg-brand-50 text-brand-700 hover:bg-brand-100" title="${t('idCardTitle')}" onclick="showIdCard('${m.id}')"><i class="fa-solid fa-id-card"></i></button>
        ${m.status === 'active' ? `<button class="row-btn bg-amber-100 text-amber-700 hover:bg-amber-200" title="${t('deactivateMember')}" onclick="toggleMemberStatus('${m.id}')"><i class="fa-solid fa-user-slash"></i></button>` : `<button class="row-btn bg-green-100 text-green-700 hover:bg-green-200" title="${t('activateMember')}" onclick="toggleMemberStatus('${m.id}')"><i class="fa-solid fa-user-check"></i></button>`}
        <button class="row-btn bg-slate-100 text-slate-600 hover:bg-slate-200" title="${t('editMember')}" onclick="openMemberModal('${m.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="row-btn bg-rose-50 text-rose-600 hover:bg-rose-100" title="${t('yesDelete')}" onclick="deleteMember('${m.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  $('membersEmpty').classList.toggle('hidden', list.length > 0);
  $('membersCountLine').textContent = `${fmtNum(list.length)} ${t('showingMembers')} • ${t('totalMembers')}: ${fmtNum(db.members.length)}`;
}

/* ── Member modal ───────────────────────────────────────── */
function openMemberModal(id) {
  const form = $('memberForm');
  form.reset();
  memberPhotoData = '';
  $('mPhotoPreview').innerHTML = '<i class="fa-solid fa-user text-slate-300"></i>';
  $('mDesignation').innerHTML = ROLES.map(r => `<option value="${r}">${roleName(r)}</option>`).join('');

  if (id) {
    const m = db.members.find(x => x.id === id);
    if (!m) return;
    $('memberModalTitle').textContent = t('editMember');
    $('mEditId').value = m.id;
    $('mName').value = m.name;
    $('mMemberId').value = m.memberId;
    $('mDesignation').value = m.designation;
    $('mMonthlyFee').value = String(memberMonthlyFee(m));
    $('mPhone').value = m.phone;
    $('mEmail').value = m.email || '';
    $('mBlood').value = m.blood || '';
    $('mJoinDate').value = m.joinDate || '';
    $('mStatus').value = m.status;
    $('mAddress').value = m.address || '';
    memberPhotoData = m.photo || '';
    if (m.photo) $('mPhotoPreview').innerHTML = `<img src="${m.photo}" class="w-full h-full object-cover" alt="">`;
  } else {
    $('memberModalTitle').textContent = t('addMember');
    $('mEditId').value = '';
    $('mMemberId').value = nextMemberCode();
    $('mJoinDate').value = todayISO();
    $('mDesignation').value = 'member';
    $('mMonthlyFee').value = '200';
  }
  openModal('memberModal');
}

function saveMember(e) {
  e.preventDefault();
  const editId = $('mEditId').value;
  const memberId = $('mMemberId').value.trim() || nextMemberCode();

  if (db.members.some(m => m.memberId.toLowerCase() === memberId.toLowerCase() && m.id !== editId)) {
    showToast(t('duplicateId'), 'error');
    return;
  }

  const data = {
    name: $('mName').value.trim(),
    memberId,
    designation: $('mDesignation').value,
    monthlyFee: +$('mMonthlyFee').value || 200,
    phone: $('mPhone').value.trim(),
    email: $('mEmail').value.trim(),
    blood: $('mBlood').value,
    joinDate: $('mJoinDate').value || todayISO(),
    status: $('mStatus').value,
    address: $('mAddress').value.trim(),
    photo: memberPhotoData
  };

  if (editId) {
    Object.assign(db.members.find(m => m.id === editId), data);
    showToast(t('memberUpdated'));
  } else {
    db.members.push({ id: uid(), lastPaid: null, ...data });
    showToast(t('memberAdded'));
  }
  saveDB();
  closeModal('memberModal');
  refreshAll();
}

function deleteMember(id) {
  confirmAction(t('confirmDelete'), () => {
    db.members = db.members.filter(m => m.id !== id);
    saveDB();
    showToast(t('memberDeleted'));
    refreshAll();
  });
}
/* Quick toggle: active <-> inactive */
function toggleMemberStatus(id) {
  const m = db.members.find(x => x.id === id);
  if (!m) return;
  if (m.status === 'active') {
    confirmAction(t('confirmDeactivate'), () => {
      m.status = 'inactive';
      saveDB();
      showToast(t('memberDeactivated'));
      refreshAll();
    });
  } else {
    m.status = 'active';
    saveDB();
    showToast(t('memberActivated'));
    refreshAll();
  }
}

/* Quick-collect this month's subscription */
function collectSubscription(memberId) {
  const m = db.members.find(x => x.id === memberId);
  if (!m) return;
  db.transactions.push({
    id: uid(), date: todayISO(), type: 'income', category: 'subscription',
    amount: +db.settings.monthlyFee || 0,
    description: `${m.name}${currentLang === 'bn' ? ' এর মাসিক চাঁদা' : "'s monthly subscription"}`,
    vendor: '', memberId: m.id, createdAt: Date.now()
  });
  recomputeAllLastPaid();
  saveDB();
  showToast(`✓ ${m.name} — ${t('collected')}`);
  refreshAll();
}

/* ── Digital ID Card ────────────────────────────────────── */
function buildIdCardHTML(m) {
  const orgName = currentLang === 'bn' ? db.settings.orgName : (db.settings.orgNameEn || db.settings.orgName);
  const photo = m.photo
    ? `<img src="${m.photo}" alt="">`
    : `<span>${esc(initials(m.name))}</span>`;
  return `
  <div class="idcard" id="idCardEl">
    <div class="idcard-watermark">OTW</div>
    <div class="idcard-header">
      <div class="idcard-logo">OTW</div>
      <div>
        <div class="idcard-org">${esc(orgName)}</div>
        <div class="idcard-tag">${t('appTagline')}</div>
      </div>
      <div class="idcard-badge">MEMBER ID</div>
    </div>
    <div class="idcard-body">
      <div class="idcard-photo">${photo}</div>
      <div class="idcard-info">
        <div class="idcard-name">${esc(m.name)}</div>
        <div class="idcard-role">${roleName(m.designation)}</div>
        <div class="idcard-row"><span class="k">${t('fMemberId')}</span><span class="v">${esc(num(m.memberId))}</span></div>
        <div class="idcard-row"><span class="k">${t('fPhone')}</span><span class="v">${esc(num(m.phone))}</span></div>
        ${m.blood ? `<div class="idcard-row"><span class="k">${t('fBlood')}</span><span class="v">${esc(m.blood)}</span></div>` : ''}
        <div class="idcard-row"><span class="k">${t('cardMemberSince')}</span><span class="v">${fmtDate(m.joinDate)}</span></div>
      </div>
      <div class="idcard-qr">
        <div class="idcard-qr-box" id="idCardQr"></div>
        <p>${t('cardScan')}</p>
      </div>
    </div>
        ${memberTxnHistoryHTML(m)}
    <div class="idcard-footer">
      <span><i class="fa-solid fa-location-dot"></i> ${esc(db.settings.orgAddress || '')}</span>
      <span class="idcard-status ${m.status}">${m.status === 'active' ? t('statusActive') : t('statusInactive')}</span>
    </div>
  </div>`;
}

/* Member's own transaction history (shown on the ID card) */
function memberTxnHistoryHTML(m) {
  const txns = db.transactions
    .filter(x => x.memberId === m.id)
    .sort((a, b) => a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1))
    .slice(0, 8);
  if (!txns.length) return '';
  return `<div class="px-5 pb-4">
    <p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">${t('cardTxnHistory')}</p>
    ${txns.map(x => `<div class="flex items-center gap-2 py-1 text-sm border-t border-slate-100">
      <span class="text-slate-400 text-xs whitespace-nowrap">${fmtDate(x.date)}</span>
      <span class="flex-1 truncate text-slate-700">${esc(x.description || catName(x.category))}</span>
      <span class="font-semibold whitespace-nowrap ${x.type === 'income' ? 'text-emerald-700' : 'text-rose-600'}">${x.type === 'income' ? '+' : '−'}${fmtMoney(x.amount)}</span>
    </div>`).join('')}
  </div>`;
}
function drawQr(member) {
  const box = $('idCardQr');
  if (!box) return;
  box.innerHTML = '';
  const payload = `OTW MEMBER\nID: ${member.memberId}\nName: ${member.name}\nRole: ${roleName(member.designation)}\nPhone: ${member.phone}`;
  if (typeof QRCode !== 'undefined') {
    new QRCode(box, { text: payload, width: 66, height: 66, correctLevel: QRCode.CorrectLevel.M });
  } else {
    box.innerHTML = '<i class="fa-solid fa-qrcode text-4xl text-slate-300"></i>';
  }
}

function showIdCard(id) {
  const m = db.members.find(x => x.id === id);
  if (!m) return;
  currentCardMember = m;
  $('idCardContainer').innerHTML = buildIdCardHTML(m);
  drawQr(m);
  openModal('idCardModal');
}

function printIdCard() {
  if (!currentCardMember) return;
  const area = $('print-area');
  area.innerHTML = buildIdCardHTML(currentCardMember);
  const box = area.querySelector('#idCardQr');
  if (box && typeof QRCode !== 'undefined') {
    new QRCode(box, {
      text: `OTW MEMBER\nID: ${currentCardMember.memberId}\nName: ${currentCardMember.name}\nPhone: ${currentCardMember.phone}`,
      width: 66, height: 66, correctLevel: QRCode.CorrectLevel.M
    });
  }
  setTimeout(() => window.print(), 350);
}

async function downloadIdCard() {
  const el = $('idCardEl');
  if (!el || typeof html2canvas === 'undefined') return;
  const prevTransform = el.style.transform;
  el.style.transform = 'none';
  try {
    const canvas = await html2canvas(el, { scale: 3, backgroundColor: null, useCORS: true });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `OTW-ID-${currentCardMember.memberId}.png`;
    a.click();
  } catch (e) { console.warn(e); }
  el.style.transform = prevTransform;
}
