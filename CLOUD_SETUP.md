# ☁️ OTW Cloud Setup — Team Login & Live Sync

By default, OTW runs in **Local Mode**: data is saved only in each person's browser.
Follow this one-time guide (about **10 minutes**, completely **free**) to switch to
**Cloud Mode**, where your whole team logs in and shares **one live, always-updated**
set of members & হিসাব from any phone or computer.

**You need:** a Google account (Gmail). The cloud database will belong to *your*
organization's Google account — nobody else can access it.

---

## Part 1 — Create the Firebase project

1. Go to **https://console.firebase.google.com** and sign in with your Google account
2. Click **"Add project"** (বা "Create a project")
3. Project name: `OTW` (or your organization name) → **Continue**
4. You may turn **OFF** Google Analytics (not needed) → **Create project**
5. Wait until it says "Your new project is ready" → **Continue**

## Part 2 — Enable Login (Email/Password)

1. In the left menu: **Build → Authentication**
2. Click **Get started**
3. Open the **Sign-in method** tab → click **Email/Password**
4. Turn **Enable** ON → **Save**

## Part 3 — Create the Database + Security Rules

1. Left menu: **Build → Firestore Database** → **Create database**
2. Location: choose the default (or `asia-southeast1`) → **Next**
3. Choose **Start in production mode** → **Create**
4. Open the **Rules** tab at the top
5. Delete everything there and paste the full contents of the
   [`firestore.rules`](firestore.rules) file from this repository
6. Click **Publish**

> 🔒 These rules guarantee: nobody can see data without login + approval,
> new sign-ups stay "pending" with zero access, only Admin/Treasurer can edit,
> Viewers are read-only, and only Admins can manage the team.

## Part 4 — Create the FIRST Admin account

1. Left menu: **Build → Authentication** → **Users** tab → **Add user**
2. Enter **your email + a password** → **Add user**
3. The user appears in the list — **copy the "User UID"** (a long code like `xYz123...`)
4. Left menu: **Build → Firestore Database** → **Data** tab → **Start collection**
   - Collection ID: `roles` → **Next**
   - Document ID: **paste the User UID** you copied
   - Add field: `email` — type `string` — value: your email
   - Add field: `role` — type `string` — value: `admin`
   - Click **Save**

## Part 5 — Get your Web Config

1. Click the **gear icon ⚙️** (top-left, next to "Project Overview") → **Project settings**
2. Scroll down to **"Your apps"** → click the **Web icon `</>`**
3. App nickname: `OTW Web` → **Register app** (leave "Firebase Hosting" unchecked)
4. You will see a `firebaseConfig` — it looks like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

5. Copy the whole thing. *(This config is not a secret — it is safe in the website code.
   Security comes from the login + rules, not from hiding this.)*

## Part 6 — Connect the config to your website

**Option A — Permanent (recommended): works for every device automatically**
- Put the config into [`js/firebase-config.js`](js/firebase-config.js)
  (replace `null` with the config object), commit & push to `main`.
  The site redeploys itself within a few minutes.
  *(Not comfortable editing code? Just send the config to your developer / ask Arena AI
  in this chat: "here is my Firebase config, connect it" — it takes one minute.)*

**Option B — Quick test on one device (no code change)**
- Open the live site → **সেটিংস (Settings)** → **ক্লাউড সিঙ্ক ও টিম অ্যাক্সেস** card
- Paste the config → **ক্লাউডে সংযোগ করুন** — the page reloads into Cloud Mode
  *(Repeat on each device, or use Option A to make it permanent.)*

## Part 7 — Log in & invite your team

1. Open the site → you now see a **login screen**
2. Log in with the **admin email/password** from Part 4
   - ✅ Your existing local data (members, হিসাব) uploads to the cloud automatically
     on first login — nothing is lost
3. **Invite a teammate** (e.g. your কোষাধ্যক্ষ / treasurer):
   - They open the site → **নতুন অ্যাকাউন্ট (Create Account)** with their email + password
   - They will see **"অনুমোদনের অপেক্ষায়" (Waiting for Approval)** — this is correct!
   - You (admin) go to **সেটিংস → টিম অ্যাক্সেস ব্যবস্থাপনা** → set their role:
     - **কোষাধ্যক্ষ (Treasurer)** — can add/edit/delete members & transactions
     - **দর্শক (Viewer)** — can only view (perfect for auditors / president)
     - **অ্যাডমিন (Admin)** — full control including team management
   - Their waiting screen opens automatically — they are in! 🎉

From now on, **every change syncs live**: the treasurer adds an expense on her phone,
and it appears on your screen within seconds. The ☁️ icon in the header shows sync status.

---

## ℹ️ Good to know

- **Cost:** Firebase's free "Spark" plan is more than enough for a community
  organization (50,000 reads/day included free).
- **Data ownership:** everything lives in *your* Firebase project. You can view or
  export it anytime from the Firebase Console (Firestore → `appdata` collection).
- **Backup:** Settings → JSON backup export/import still works in Cloud Mode.
- **Offline:** the app keeps a local copy, so it opens instantly and works offline;
  changes sync when the internet returns.
- **Photos:** member photos are stored inside the database document (limit ≈ 1 MB total).
  Photos are auto-resized small, which comfortably fits a few hundred members.
- **Remove someone's access:** Admin → Settings → Team Access → set their role back
  to **অপেক্ষমাণ (Pending)**, or delete their user in Firebase Console → Authentication.
