# চলার পথে (OTW) — সংগঠন নির্দেশক ও হিসাব সহকারী

**Organization Directory & Financial Assistant** — a complete, responsive web application for managing organization members, digital ID cards, cash flow (জমা-খরচ) tracking, receipt scanning, and financial reporting. Built for organizations & trust management in Bangladesh.

🌐 **Dual language:** বাংলা (primary) ⇄ English · 🎨 **Theme:** Deep Emerald Green, Slate Gray, Clean White, Warm Gold

---

## ✨ Features

### 1. 👥 Member Directory & Digital ID Card (সদস্য ডিরেক্টরি ও ডিজিটাল কার্ড)
- Member registration: name, designation, member ID (auto-generated `OTW-001`), phone, email, blood group, address, join date, photo upload, active/inactive status
- Live search by name / ID / phone + filters by designation & status
- Monthly subscription status (পরিশোধিত / বকেয়া) tracked per member with one-click **“Collect”**
- **Digital ID card generator** (CR80 size) with photo, QR verification code, org branding — **printable** & **downloadable as PNG**

### 2. 📖 Financial Management & Cash Book (জমা-খরচ ও হিসাব সহকারী)
- Daily income/expense entries with category tags (সদস্য চাঁদা, অনুদান, অফিস খরচ, মুদ্রণ, পরিবহন, সামাজিক কল্যাণ…)
- Proper ledger with separate **জমা / খরচ columns and a live running balance**
- Filter by type, category, month, or free-text search; real-time balance everywhere (sidebar, dashboard, cash book)

### 3. 🧾 Receipt / Cash Memo Scanner (রশিদ স্ক্যানার)
- Drag-&-drop or upload a receipt photo → **OCR (Tesseract.js)** auto-extracts **vendor, date & total amount**
- Verify/edit extracted fields, then post directly to the cash book as an expense

### 4. 📊 Financial Analytics & Reporting (আর্থিক বিবরণী ও বিশ্লেষণ)
- Summary cards: Total Income · Total Expense · Net Balance · **Pending Monthly Subscriptions**
- Interactive Chart.js visuals: monthly income vs. expense, expense-by-category doughnut, yearly trend lines, income-by-category
- Monthly summary & category breakdown tables
- **Exports:** CSV download + print-ready financial statement (save as PDF) with signature blocks

### 5. ⚙️ Settings & Data
- Organization name (বাংলা/English), address, monthly subscription fee, default language
- JSON backup export/import, demo-data loader, full data reset
- All data persists in the browser via `localStorage` — no server required

---

## 🗂️ Project Architecture

```
OTW/
├── index.html            # App shell — sidebar layout, all 6 pages, modals
├── css/
│   └── style.css         # Component styles, ID-card design, print rules
└── js/
    ├── i18n.js           # বাংলা/English dictionary, roles & categories
    ├── utils.js          # ৳ & Bengali-numeral formatting, dates, helpers
    ├── storage.js        # localStorage data layer, demo seed, computations
    ├── members.js        # Directory CRUD, subscription collect, ID cards
    ├── finance.js        # Cash-book ledger, filters, transaction CRUD
    ├── scanner.js        # OCR receipt scanning & field extraction
    ├── reports.js        # Charts, CSV export, printable statements
    ├── app.js            # Router, dashboard, settings, backup, init
    ├── firebase-config.js# Paste your Firebase config here to enable Cloud Mode
    └── cloud.js          # Optional Firebase layer: login, roles, live sync
├── firestore.rules       # Firestore security rules (roles & permissions)
├── CLOUD_SETUP.md        # Step-by-step guide: team login & cloud sync setup
└── .github/workflows/    # Auto-deploy to GitHub Pages on push to main
```

**Tech stack:** HTML5 · Tailwind CSS (CDN) · Vanilla JS (modular) · Chart.js · Tesseract.js (OCR) · html2canvas · QRCode.js · FontAwesome · Hind Siliguri + Inter fonts

---

## ☁️ Cloud Mode — Team Login & Live Sync (Optional)

Out of the box the app runs in **Local Mode** (data per browser). Connect a free
**Firebase** project to enable **Cloud Mode**:

- 🔐 **Login accounts** (email/password) — new sign-ups wait as *Pending* until an admin approves them
- 👥 **Roles:** **Admin** (full control + team management) · **Treasurer** (edit data) · **Viewer** (read-only)
- 🔄 **Real-time sync** — an entry added on one phone appears on everyone's screen in seconds
- 🛡️ Server-side enforcement via [`firestore.rules`](firestore.rules); offline cache keeps the app instant

**Setup (≈10 minutes, free):** follow **[CLOUD_SETUP.md](CLOUD_SETUP.md)**, then paste your
config into [`js/firebase-config.js`](js/firebase-config.js) (or via Settings → Cloud on the site).

---

## 🚀 Getting Started

No build step needed. Serve the folder with any static server:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open **http://localhost:8000** in your browser. The app loads with realistic demo data (12 members, 6 months of transactions) so every feature can be explored immediately. Use **Settings → Load Demo Data / Clear All Data** to reset.

> An internet connection is required for CDN libraries (Tailwind, Chart.js, Tesseract OCR engine, fonts).

---

## 📝 Notes

- Numbers are rendered with **Bengali digits** and lakh-style grouping (৳ ১,২৩,৪৫৬) in বাংলা mode.
- Subscription dues are computed against the current month and the fee configured in Settings.
- ID-card print uses exact CR80 dimensions (85.6 × 54 mm); choose “Save as PDF” in the print dialog for digital copies.
