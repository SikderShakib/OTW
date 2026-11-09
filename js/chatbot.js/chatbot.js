/* ════════════════════════════════════════════════════════════
   OTW Assistant — free rule-based FAQ chatbot (plain script).
   No AI, no API key, no cost. READ-ONLY: it never writes db,
   never touches Firestore, never changes anything. It only
   answers from db / localStorage + the signed-in user's own
   profile (OTWCloud.getMyProfile()).
   ════════════════════════════════════════════════════════════ */

var CHATBOT_JOIN_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdgitUpLXgK3xjKPK6ESceftxNOIw2qukotOLpqgBsDODMUXg/viewform';

let chatOpened = false;

/* ── Sign-in / profile gates ─────────────────────────────── */
function chatRole() { return (window.OTWCloud && OTWCloud.getRole()) || null; }
function chatProfile() { return (window.OTWCloud && OTWCloud.getMyProfile && OTWCloud.getMyProfile()) || null; }
function chatLang() { return (typeof currentLang !== 'undefined' && currentLang) ? currentLang : 'bn'; }
function chatL(bn, en) { return chatLang() === 'en' ? en : bn; }
function orgCanSee() {
  var r = chatRole();
  return r === 'admin' || r === 'treasurer' || r === 'viewer';
}
function needProfile() {
  if (!chatRole()) return t('botNoLogin');
  if (!chatProfile()) return t('botNoProfile');
  return null;
}
function needOrg() {
  if (!chatRole()) return t('botNoLogin');
  if (!orgCanSee()) return t('botMembersOnly');
  return null;
}
function needSignIn() {
  if (!chatRole()) return t('botNoLogin');
  return null;
}

/* ── Matching helpers ────────────────────────────────────── */
function hasAny(q, words) {
  for (var i = 0; i < words.length; i++) {
    if (q.indexOf(words[i]) !== -1) return true;
  }
  return false;
}
function hasWord(q, w) { return new RegExp('\\b' + w + '\\b').test(q); }
function isPersonal(q) {
  return q.indexOf('আমার') !== -1 || hasWord(q, 'amar') || hasWord(q, 'my');
}
function firstActive(designation) {
  var ms = (typeof db !== 'undefined' && db && db.members) || [];
  for (var i = 0; i < ms.length; i++) {
    if (ms[i].designation === designation && ms[i].status !== 'inactive') return ms[i];
  }
  return null;
}

/* ── Panel ───────────────────────────────────────────────── */
function toggleChatbot() {
  var p = $('chatPanel');
  if (!p) return;
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden') && !chatOpened) {
    chatOpened = true;
    chatAdd(t('botGreeting'), 'bot');
    chatAdd(t('botHelp'), 'bot');
    buildChips();
  }
}

function chatAdd(text, who) {
  var box = $('chatMessages');
  if (!box) return;
  var d = document.createElement('div');
  d.className = 'chat-bubble ' + (who === 'user' ? 'chat-msg-user bg-brand-700 text-white ml-auto' : 'chat-msg-bot bg-slate-100 text-slate-800');
  d.innerHTML = who === 'user' ? esc(text) : text;
  box.appendChild(d);
  box.scrollTop = box.scrollHeight;
}

function buildChips() {
  var box = $('chatChips');
  if (!box || box.childNodes.length) return;
  ['botChipDue', 'botChipLast', 'botChipNotice', 'botChipJoin'].forEach(function (key) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'chat-chip';
    b.textContent = t(key);
    b.onclick = function () { sendChatPreset(t(key)); };
    box.appendChild(b);
  });
}

function sendChat() {
  var inp = $('chatInput');
  if (!inp) return;
  var q = inp.value.trim();
  if (!q) return;
  inp.value = '';
  sendChatPreset(q);
}

function sendChatPreset(text) {
  chatAdd(text, 'user');
  chatAdd(chatAnswer(text), 'bot');
}

/* ── Answers ─────────────────────────────────────────────── */
function myDueAnswer() {
  var err = needProfile();
  if (err) return err;
  var p = chatProfile();
  return t('myDue') + ': ' + fmtMoney(p.due || 0);
}

function myLastPaidAnswer() {
  var err = needProfile();
  if (err) return err;
  var p = chatProfile();
  return t('myLastPaid') + ': ' + (p.lastPaid ? monthFullLabel(p.lastPaid) : '—');
}

function myFeeAnswer() {
  var err = needProfile();
  if (err) return err;
  var p = chatProfile();
  return t('myMonthlyFee') + ': ' + fmtMoney(p.monthlyFee || 0);
}

function myTotalAnswer() {
  var err = needProfile();
  if (err) return err;
  var p = chatProfile();
  return t('myTotalPaid') + ': ' + fmtMoney(p.totalPaid || 0);
}

function myPaymentsAnswer() {
  var err = needProfile();
  if (err) return err;
  var p = chatProfile();
  var txns = (p.txns || []).slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  }).slice(0, 5);
  if (!txns.length) return t('myNoPayments');
  var lines = [t('myPayments') + ':'];
  txns.forEach(function (x) {
    lines.push(fmtDate(x.date) + ' — ' + (x.description || catName(x.category || '')) + ' — ' + (x.type === 'expense' ? '-' : '+') + fmtMoney(x.amount || 0));
  });
  return lines.join('\n');
}

function payHowAnswer() {
  var err = needSignIn();
  if (err) return err;
  var tr = firstActive('treasurer');
  if (!tr) return t('noData');
  return chatL(
    'কোষাধ্যক্ষ ' + tr.name + ' (' + (tr.memberId || '') + ')-এর কাছে জমা দিন — তিনি Cash Book-এ এন্ট্রি দেবেন।',
    'Please hand your payment to the treasurer, ' + tr.name + ' (' + (tr.memberId || '') + ') — they will record it in the Cash Book.'
  );
}

function totalsAnswer() {
  var err = needOrg();
  if (err) return err;
  return t('totalIncome') + ': ' + fmtMoney(totalIncome()) + '\n' +
    t('totalExpense') + ': ' + fmtMoney(totalExpense()) + '\n' +
    t('currentBalance') + ': ' + fmtMoney(currentBalance());
}

function pendingAnswer() {
  var err = needOrg();
  if (err) return err;
  var pend = pendingMembers();
  var sum = 0;
  pend.forEach(function (m) { sum += memberDue(m); });
  return t('pendingMembers') + ': ' + pend.length + ' ' + t('membersWord') + '\n' +
    t('pendingSub') + ': ' + fmtMoney(sum);
}

function countAnswer() {
  var err = needOrg();
  if (err) return err;
  var ms = (typeof db !== 'undefined' && db && db.members) || [];
  var active = ms.filter(function (m) { return m.status !== 'inactive'; }).length;
  return t('totalMembers') + ': ' + ms.length + '\n' + t('activeMembers') + ': ' + active;
}

function noticeAnswer() {
  var err = needSignIn();
  if (err) return err;
  var ns = (((typeof db !== 'undefined' && db) || {}).notices || []).slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
  if (!ns.length) return t('noNotices');
  var n = ns[0];
  return (n.title || n.body || '') + '\n' + fmtDate(n.date);
}

function leadersAnswer() {
  var err = needSignIn();
  if (err) return err;
  var lines = [];
  ['president', 'gs', 'treasurer'].forEach(function (d) {
    var m = firstActive(d);
    if (m) lines.push(roleName(d) + ': ' + m.name + ' (' + (m.memberId || '') + ')');
  });
  if (!lines.length) return t('noData');
  return lines.join('\n');
}

function joinAnswer() {
  return t('botJoinText') + '<br><a href="' + CHATBOT_JOIN_URL + '" target="_blank" rel="noopener">' + CHATBOT_JOIN_URL + '</a>';
}

function aboutAnswer() {
  var s = ((typeof db !== 'undefined' && db) || {}).settings || {};
  var name = chatLang() === 'en' ? (s.orgNameEn || s.orgName || '') : (s.orgName || '');
  var addr = s.orgAddress || '';
  if (!name && !addr) return t('noData');
  return name + (addr ? '\n' + addr : '');
}

/* ── The brain ───────────────────────────────────────────── */
function chatAnswer(q) {
  q = String(q || '').toLowerCase().trim().replace(/\s+/g, ' ');

  /* greeting / help */
  if (hasWord(q, 'hi') || hasWord(q, 'hey') || hasAny(q, ['hello', 'সালাম', 'salam', 'আসসালামু', 'assalamu', 'help', 'সাহায্য', 'sahajjo', 'কী পারো', 'ki paro', 'what can you do', 'হেল্প', 'হাই'])) {
    return t('botGreeting') + '\n' + t('botHelp');
  }

  /* due / pending: 'বাকি' alone (no আমার/amar/my) → pending-dues list */
  if (hasAny(q, ['বাকি', 'baki', 'বকেয়া', 'কে বাকি', 'pending']) || hasWord(q, 'due')) {
    if (isPersonal(q)) return myDueAnswer();
    return pendingAnswer();
  }

  /* my last payment */
  if (hasAny(q, ['শেষ জমা', 'last paid', 'last payment', 'sesh joma', 'শেষ দিয়েছি'])) return myLastPaidAnswer();

  /* my monthly fee */
  if (hasAny(q, ['মাসিক চাঁদা', 'monthly fee', 'চাঁদা কত', 'মাসিক ফি', 'চাঁদার পরিমাণ'])) return myFeeAnswer();

  /* my total paid */
  if (hasAny(q, ['মোট জমা', 'total paid', 'total joma', 'কত জমা'])) return myTotalAnswer();

  /* my payments */
  if (hasAny(q, ['জমার তালিকা', 'payment list', 'লেনদেন', 'my payments', 'জমার ইতিহাস'])) return myPaymentsAnswer();

  /* how to pay */
  if (hasAny(q, ['কীভাবে দেব', 'কিভাবে দেব', 'how to pay', 'how do i pay', 'বিকাশ', 'bkash', 'কোথায় দেব', 'কোথায় জমা', 'কীভাবে জমা'])) return payHowAnswer();

  /* org totals */
  if (hasAny(q, ['মোট আয়', 'total income', 'মোট ব্যয়', 'total expense', 'ব্যালেন্স', 'balance', 'হিসাব', 'hisab', 'আয় ব্যয়'])) return totalsAnswer();

  /* member count */
  if (hasAny(q, ['সদস্য কত', 'how many members', 'কয়জন', 'koyjon', 'কতজন সদস্য', 'সদস্য সংখ্যা', 'মোট সদস্য'])) return countAnswer();

  /* latest notice */
  if (hasAny(q, ['নোটিশ', 'notice', 'notis'])) return noticeAnswer();

  /* leaders */
  if (hasAny(q, ['সভাপতি', 'president', 'সম্পাদক', 'secretary', 'কোষাধ্যক্ষ', 'treasurer'])) return leadersAnswer();

  /* join */
  if (hasAny(q, ['যোগ দিতে', 'join', 'সদস্য হতে', 'member hote', 'সদস্য হব'])) return joinAnswer();

  /* about */
  if (hasAny(q, ['সংগঠন', 'about', 'what is otw', 'otw কি', 'চলার পথে']) || hasWord(q, 'otw')) return aboutAnswer();

  /* fallback */
  return t('botUnknown') + '\n' + t('botHelp');
}

/* ── Init: Enter key sends ───────────────────────────────── */
if ($('chatInput')) {
  $('chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChat();
    }
  });
}
