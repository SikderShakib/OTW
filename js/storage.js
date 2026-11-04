/* ════════════════════════════════════════════════════════════
   OTW — Data layer: localStorage persistence, seed data,
   and core financial computations
   ════════════════════════════════════════════════════════════ */

const DB_KEY = 'otw_db_v1';
let db = loadDB();

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.settings && Array.isArray(parsed.members)) return parsed;
    }
  } catch (e) { /* corrupted storage → reseed */ }
  const fresh = seedData();
  try { localStorage.setItem(DB_KEY, JSON.stringify(fresh)); } catch (e) {}
  return fresh;
}
function saveDB() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { console.warn('Storage full', e); }
  /* Cloud mode: schedule a debounced push to Firestore (see js/cloud.js) */
  if (typeof window !== 'undefined' && window.OTWCloud && window.OTWCloud.schedulePush) {
    try { window.OTWCloud.schedulePush(); } catch (e) {}
  }
}

/* ── Seed / demo data ───────────────────────────────────── */
function seedData() {
  const settings = {
    orgName: 'চলার পথে (OTW)',
    orgNameEn: 'Cholar Pothe (OTW)',
    orgAddress: 'ধানমন্ডি, ঢাকা-১২০৫',
    monthlyFee: 200,
    lang: 'bn'
  };

  const memberSeed = [
    ['মোঃ আব্দুর রহিম',      'president', '01712345601', 'B+',  '2022-01-10', 'ধানমন্ডি, ঢাকা'],
    ['ফাতেমা বেগম',          'vp',        '01812345602', 'A+',  '2022-01-10', 'মিরপুর, ঢাকা'],
    ['মোঃ করিম উদ্দিন',      'gs',        '01912345603', 'O+',  '2022-02-05', 'উত্তরা, ঢাকা'],
    ['শারমিন আক্তার',        'jgs',       '01612345604', 'AB+', '2022-03-12', 'ধানমন্ডি, ঢাকা'],
    ['মোঃ জসিম উদ্দিন',      'treasurer', '01512345605', 'B-',  '2022-01-18', 'গুলশান, ঢাকা'],
    ['রফিকুল ইসলাম',         'org',       '01712345606', 'A-',  '2022-06-20', 'বাড্ডা, ঢাকা'],
    ['নাসরিন সুলতানা',       'office',    '01812345607', 'O-',  '2022-07-02', 'মোহাম্মদপুর, ঢাকা'],
    ['মোঃ শাহিন আলম',        'member',    '01912345608', 'B+',  '2023-01-15', 'যাত্রাবাড়ী, ঢাকা'],
    ['তানিয়া আহমেদ',        'member',    '01612345609', 'A+',  '2023-03-08', 'মিরপুর, ঢাকা'],
    ['মোঃ রাকিবুল হাসান',    'member',    '01512345610', 'O+',  '2023-05-22', 'খিলগাঁও, ঢাকা'],
    ['সুমাইয়া খাতুন',       'member',    '01712345611', 'AB-', '2023-09-10', 'শ্যামলী, ঢাকা'],
    ['মোঃ তৌহিদুল ইসলাম',    'member',    '01812345612', 'B+',  '2024-02-14', 'নারায়ণগঞ্জ']
  ];

  const members = memberSeed.map((m, i) => ({
    id: 'mem_' + (i + 1),
    memberId: 'OTW-' + String(i + 1).padStart(3, '0'),
    name: m[0], designation: m[1], phone: m[2], blood: m[3],
    joinDate: m[4], address: m[5], email: '', photo: '',
    status: 'active', lastPaid: null
  }));

  /* Transactions for the last 6 months (deterministic) */
  const rand = mulberry32(20261104);
  const ri = (min, max) => Math.round(min + rand() * (max - min));
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const transactions = [];
  let seq = 0;
  const push = (date, type, category, amount, description, vendor, memberId) => {
    transactions.push({ id: 'txn_' + (++seq), date, type, category, amount, description, vendor: vendor || '', memberId: memberId || '', createdAt: seq });
  };

  const donors = ['মোঃ হাবিবুর রহমান', 'আলহাজ্ব মোঃ সেলিম রেজা', 'ডাঃ ফারহানা আহমেদ', 'প্রকৌশলী তানভীর হোসেন'];
  const officeItems = ['অফিস সরঞ্জাম ক্রয়', 'স্টেশনারি ও কাগজপত্র', 'ইন্টারনেট বিল পরিশোধ', 'অফিস ভাড়া (আংশিক)', 'চা-নাশতা ও আপ্যায়ন'];
  const officeVendors = ['নিউ মার্কেট স্টেশনারি', 'আইডিবি ভবন কম্পিউটার', 'গ্রামীণফোন', 'ঢাকা ট্রেডার্স'];
  const printItems = ['ব্যানার ও পোস্টার ছাপা', 'লিফলেট মুদ্রণ', 'সদস্য ফরম ছাপা', 'বার্ষিক প্রতিবেদন মুদ্রণ'];
  const printVendors = ['রহিম প্রিন্টার্স', 'নীলক্ষেত প্রেস', 'মডার্ণ প্রিন্টিং'];
  const events = ['বার্ষিক সাধারণ সভা', 'ক্রীড়া প্রতিযোগিতা', 'সাংস্কৃতিক অনুষ্ঠান', 'ইফতার মাহফিল', 'প্রশিক্ষণ কর্মশালা'];

  const now = new Date();
  for (let back = 5; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = base.getFullYear(), mo = base.getMonth();
    const dim = new Date(y, mo + 1, 0).getDate();
    const maxDay = back === 0 ? Math.max(1, now.getDate()) : dim;
    const dstr = day => `${y}-${String(mo + 1).padStart(2, '0')}-${String(Math.min(day, maxDay)).padStart(2, '0')}`;
    const isCurrent = back === 0;

    /* Subscriptions — in the current month only the first 8 members have paid */
    members.forEach((m, i) => {
      const paid = isCurrent ? i < 8 : rand() > 0.15;
      if (paid) push(dstr(ri(2, 12)), 'income', 'subscription', settings.monthlyFee, `${m.name} এর মাসিক চাঁদা`, '', m.id);
    });

    /* Donations + occasional event income */
    push(dstr(ri(5, 20)), 'income', 'donation', ri(3000, 15000), `অনুদান — ${pick(donors)}`);
    if (rand() > 0.4) push(dstr(ri(8, 24)), 'income', 'donation', ri(2000, 8000), `অনুদান — ${pick(donors)}`);
    if (rand() > 0.35) push(dstr(ri(10, 25)), 'income', 'event_income', ri(4000, 15000), `${pick(events)} স্পন্সরশিপ`);

    /* Expenses */
    push(dstr(ri(3, 15)), 'expense', 'office', ri(600, 3500), pick(officeItems), pick(officeVendors));
    push(dstr(ri(10, 22)), 'expense', 'office', ri(400, 2000), pick(officeItems), pick(officeVendors));
    if (rand() > 0.35) push(dstr(ri(6, 20)), 'expense', 'printing', ri(800, 4500), pick(printItems), pick(printVendors));
    if (rand() > 0.45) push(dstr(ri(12, 26)), 'expense', 'event', ri(3000, 10000), pick(events) + ' আয়োজন', 'ইভেন্ট ম্যানেজমেন্ট টিম');
    push(dstr(ri(4, 26)), 'expense', 'transport', ri(300, 1500), 'সাংগঠনিক কাজে যাতায়াত', '');
    if (rand() > 0.5) push(dstr(ri(8, 24)), 'expense', 'welfare', ri(1000, 6000), 'দুস্থ পরিবার সহায়তা', '');
  }

  const data = { settings, members, transactions };
  recomputeAllLastPaid(data);
  return data;
}

/* ── Core computations ──────────────────────────────────── */
function sortedTxns(list) {
  return [...(list || db.transactions)].sort((a, b) =>
    a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : (a.date < b.date ? -1 : 1));
}
function totalIncome(list) { return (list || db.transactions).filter(t => t.type === 'income').reduce((s, t) => s + (+t.amount || 0), 0); }
function totalExpense(list) { return (list || db.transactions).filter(t => t.type === 'expense').reduce((s, t) => s + (+t.amount || 0), 0); }
function currentBalance() { return totalIncome() - totalExpense(); }

/* Map of txn id → running balance immediately after that transaction */
function runningBalances() {
  const map = {};
  let bal = 0;
  sortedTxns().forEach(t => { bal += t.type === 'income' ? (+t.amount || 0) : -(+t.amount || 0); map[t.id] = bal; });
  return map;
}

/* Keep member.lastPaid in sync with subscription transactions */
function recomputeAllLastPaid(data) {
  const d = data || db;
  d.members.forEach(m => {
    const subs = d.transactions.filter(t => t.type === 'income' && t.category === 'subscription' && t.memberId === m.id);
    m.lastPaid = subs.length ? subs.map(t => monthKeyOf(t.date)).sort().pop() : null;
  });
}
function isPaidThisMonth(member) { return !!member.lastPaid && member.lastPaid >= currentMonthKey(); }
function pendingMembers() { return db.members.filter(m => m.status === 'active' && !isPaidThisMonth(m)); }
function nextMemberCode() {
  let max = 0;
  db.members.forEach(m => { const n = parseInt(String(m.memberId).replace(/\D/g, ''), 10); if (!isNaN(n) && n > max) max = n; });
  return 'OTW-' + String(max + 1).padStart(3, '0');
}
