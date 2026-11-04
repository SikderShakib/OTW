/* ════════════════════════════════════════════════════════════
   OTW — Cash Memo / Receipt Scanner (OCR via Tesseract.js)
   Extracts vendor, date and total amount from receipt images
   ════════════════════════════════════════════════════════════ */

let receiptImageData = null; // dataURL of the uploaded receipt

function initScanner() {
  const dz = $('dropzone');
  const input = $('receiptInput');

  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files[0]) loadReceiptImage(input.files[0]); });

  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragging'); }));
  dz.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadReceiptImage(f);
  });

  $('scanBtn').addEventListener('click', runOCR);
  $('addScanBtn').addEventListener('click', addScannedExpense);
  $('scanCategory').innerHTML = EXPENSE_CATEGORIES.map(c => `<option value="${c}">${catName(c)}</option>`).join('');
  $('scanDate').value = todayISO();
}

function loadReceiptImage(file) {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    receiptImageData = e.target.result;
    $('receiptPreview').src = receiptImageData;
    $('receiptPreview').classList.remove('hidden');
    $('dropzoneEmpty').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

async function runOCR() {
  if (!receiptImageData) { showToast(t('selectImageFirst'), 'error'); return; }
  if (typeof Tesseract === 'undefined') { showToast(t('scanFail'), 'error'); return; }

  const btn = $('scanBtn');
  btn.disabled = true;
  btn.style.opacity = .6;
  $('ocrProgressWrap').classList.remove('hidden');
  $('ocrBar').style.width = '4%';
  $('ocrStatus').textContent = t('initializing');

  try {
    const result = await Tesseract.recognize(receiptImageData, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          $('ocrStatus').textContent = t('recognizing');
          $('ocrBar').style.width = Math.round(10 + m.progress * 90) + '%';
        } else if (m.progress) {
          $('ocrBar').style.width = Math.round(m.progress * 10) + '%';
        }
      }
    });

    const text = result.data.text || '';
    $('ocrText').textContent = text;
    $('ocrTextWrap').classList.remove('hidden');
    $('ocrBar').style.width = '100%';

    const parsed = parseReceipt(text);
    if (parsed.vendor) $('scanVendor').value = parsed.vendor;
    if (parsed.amount) $('scanAmount').value = parsed.amount;
    if (parsed.date) $('scanDate').value = parsed.date;
    if (!$('scanDesc').value) $('scanDesc').value = t('receiptFromScanner');

    showToast(t('scanSuccess'));
  } catch (err) {
    console.warn(err);
    showToast(t('scanFail'), 'error');
  } finally {
    btn.disabled = false;
    btn.style.opacity = 1;
    setTimeout(() => $('ocrProgressWrap').classList.add('hidden'), 1200);
  }
}

/* Heuristic extraction of vendor / date / total from raw OCR text */
function parseReceipt(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);

  /* Vendor: first meaningful line (usually the shop name) */
  let vendor = '';
  for (const line of lines) {
    if (/[A-Za-z\u0980-\u09FF]/.test(line) && line.length >= 3) { vendor = line.replace(/\s+/g, ' ').slice(0, 60); break; }
  }

  /* Amount: prefer a number following total-like keywords */
  let amount = '';
  const totalRe = /(?:grand\s*total|net\s*total|total|amount\s*payable|payable|balance\s*due|cash|মোট|সর্বমোট|পরিমাণ)[^\d\n]{0,15}([\d,]+(?:\.\d{1,2})?)/i;
  const tm = text.match(totalRe);
  if (tm) {
    amount = tm[1].replace(/,/g, '');
  } else {
    const nums = (text.match(/[\d,]+(?:\.\d{1,2})?/g) || [])
      .map(s => parseFloat(s.replace(/,/g, '')))
      .filter(n => n > 0 && n < 10000000);
    if (nums.length) amount = String(Math.max(...nums));
  }

  /* Date: dd/mm/yyyy, dd-mm-yy, yyyy/mm/dd etc. */
  let date = '';
  let dm = text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (dm) {
    date = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`;
  } else {
    dm = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (dm) {
      const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
      date = `${y}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
    }
  }
  if (date && isNaN(new Date(date))) date = '';

  return { vendor, amount, date };
}

function addScannedExpense() {
  const amount = Math.abs(+$('scanAmount').value || 0);
  if (!amount) { showToast(t('enterAmount'), 'error'); return; }
  db.transactions.push({
    id: uid(),
    date: $('scanDate').value || todayISO(),
    type: 'expense',
    category: $('scanCategory').value,
    amount,
    description: $('scanDesc').value.trim() || t('receiptFromScanner'),
    vendor: $('scanVendor').value.trim(),
    memberId: '',
    createdAt: Date.now()
  });
  saveDB();
  showToast(t('txnAdded'));
  refreshAll();
  showPage('finance');
}
