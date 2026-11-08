/* ════════════════════════════════════════════════════════════
   OTW — Utility helpers
   ════════════════════════════════════════════════════════════ */

const $ = id => document.getElementById(id);
const BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];

/* Convert Latin digits in any string to Bengali digits (when lang = bn) */
function num(str) {
  const s = String(str ?? '');
  return currentLang === 'bn' ? s.replace(/\d/g, d => BN_DIGITS[d]) : s;
}

/* Number with lakh-style grouping (1,23,456), Bengali digits in bn mode */
function fmtNum(n) {
  const v = Number(n) || 0;
  return v.toLocaleString(currentLang === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 2 });
}

/* Money: ৳ ১,২৩,৪৫৬ */
function fmtMoney(n, withSign = false) {
  const v = Number(n) || 0;
  const sign = withSign ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '');
  return `${sign}৳ ${fmtNum(Math.abs(v))}`;
}

/* Dates */
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function currentMonthKey() { return todayISO().slice(0, 7); }
function monthKeyOf(iso) { return (iso || '').slice(0, 7); }
function monthLabel(year, monthIndex, style = 'short') {
  return new Date(year, monthIndex, 1)
    .toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-US', { month: style });
}
function monthFullLabel(key) { // '2026-11' → 'নভেম্বর ২০২৬'
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString(currentLang === 'bn' ? 'bn-BD' : 'en-US', { month: 'long', year: 'numeric' });
}

/* Per-member monthly subscription (100/200/500). Explicit value wins;
   otherwise derive from the member's latest subscription payment,
   else fall back to 200. */
function memberMonthlyFee(m) {
  if (!m) return 200;
  if (+m.monthlyFee) return +m.monthlyFee;
  const subs = (typeof db !== 'undefined' && db && Array.isArray(db.transactions))
    ? db.transactions.filter(x => x.memberId === m.id && x.category === 'subscription' && x.type === 'income') : [];
  if (!subs.length) return 200;
  const latest = subs.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const amt = +latest.amount || 0;
  if (amt <= 150) return 100;
  if (amt <= 300) return 200;
  return 500;
}

/* Due = unpaid months × monthly fee. Never-paid members count from Sep 2026 (first collection month); paid-in-advance members owe 0. */
function memberDue(m) {
  if (!m || m.status === 'inactive') return 0;
  const fee = memberMonthlyFee(m);
  const mk = currentMonthKey();
  let start;
  if (m.lastPaid) {
    const [y, mo] = m.lastPaid.split('-').map(Number);
    const d = new Date(y, mo, 1); // month after lastPaid
    start = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  } else {
    start = '2026-09';
  }
  if (start > mk) return 0;
  const [sy, sm] = start.split('-').map(Number);
  const [cy, cm] = mk.split('-').map(Number);
  return ((cy - sy) * 12 + (cm - sm) + 1) * fee;
}

/* Misc */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const AVATAR_COLORS = ['#047857', '#0e7490', '#b8860b', '#7c3aed', '#be185d', '#1d4ed8', '#b45309', '#0f766e'];
function avatarColor(name) {
  let h = 0; const s = String(name || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] || '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] || '') : '';
  return (first + last).toUpperCase();
}
function avatarHTML(member, sizeClass = '') {
  if (member.photo) return `<div class="avatar ${sizeClass}"><img src="${member.photo}" alt=""></div>`;
  return `<div class="avatar ${sizeClass}" style="background:${avatarColor(member.name)}">${esc(initials(member.name))}</div>`;
}

/* Read an image file, downscale to max 320px, return dataURL (keeps localStorage small) */
function readImageFile(file, maxSize = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* Trigger a file download from a Blob / dataURL */
function downloadBlob(content, filename, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* Deterministic PRNG for repeatable demo data */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let x = Math.imul(a ^ a >>> 15, 1 | a);
    x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x;
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
  };
}
