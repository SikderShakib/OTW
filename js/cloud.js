/* ════════════════════════════════════════════════════════════
   OTW — Cloud Mode: Firebase Auth + Firestore real-time sync

   • Inactive (LOCAL mode) until a Firebase config is provided
     via js/firebase-config.js or Settings → Cloud.
   • When active: users must sign in; new accounts wait as
     "pending" until an admin assigns a role:
        admin     → full access + team management
        treasurer → can add/edit/delete data
        viewer    → read-only
   • The whole app state syncs as one Firestore document
     (appdata/main) with last-write-wins + live updates.
   • The localStorage copy remains as an offline cache, so the
     app renders instantly and keeps working offline.
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var CFG_KEY = 'otw_fb_config';
  var SKIP_KEY = 'otw_skip_cloud';
  var SDK_VERSION = '10.12.2';

  var auth = null, store = null;
  var currentUser = null, myRole = null, myMemberId = null, started = false;
  var currentMemberProfile = null, unsubMemberProfile = null;
  var pushTimer = null, applyingRemote = false;
  var lastPushStamp = '', lastSeenStamp = '', firstSnapshot = true;
  var unsubData = null, unsubRoles = null, unsubOwnRole = null;
  var authMode = 'signin';
  var syncState = 'synced';
  var rolesList = [];
  var wrappedReadOnly = false;

  /* ── Config helpers ───────────────────────────────────── */
  function localCfg() {
    try { var r = localStorage.getItem(CFG_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function fileCfg() {
    try { return (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG) ? FIREBASE_CONFIG : null; }
    catch (e) { return null; }
  }
  function getCfg() { return fileCfg() || localCfg(); }
  function validCfg(c) { return !!(c && c.apiKey && c.projectId && c.appId); }
  function canWrite() { return myRole === 'admin' || myRole === 'treasurer'; }

  /* Public API — defined immediately so Settings works in local mode too */
  window.OTWCloud = {
    enabled: false,
    schedulePush: schedulePush,
    renderSettingsCard: renderSettingsCard,
    refreshUI: refreshUI,
    rerenderMember: function () { renderMemberProfile(currentMemberProfile, currentMemberProfile ? 'ok' : (myMemberId ? 'notready' : 'nolink')); },
    saveLocalConfig: saveLocalConfig,
    signOut: doSignOut,
    getRole: function () { return myRole; }
  };
  window.OTWCloudSetRole = function (uid, role) {
    if (!store || myRole !== 'admin') return;
    store.collection('roles').doc(uid).update({ role: role })
      .then(function () { showToast(t('saved')); })
      .catch(function (e) { console.warn(e); showToast(t('errGeneric'), 'error'); });
  };
  window.OTWCloudSetMemberLink = function (uid, memberId) {
    if (!store || myRole !== 'admin') return;
    store.collection('roles').doc(uid).update({ memberId: memberId || '' })
      .then(function () { showToast(t('saved')); })
      .catch(function (e) { console.warn(e); showToast(t('errGeneric'), 'error'); });
  };
  window.OTWCloudSyncMembers = function () { syncMemberProfiles(true); };

  /* ── Boot ─────────────────────────────────────────────── */
  var cfg = getCfg();
  var skip = false;
  try { skip = sessionStorage.getItem(SKIP_KEY) === '1'; } catch (e) {}

  if (!validCfg(cfg) || skip) { markLocalReady(); return; }

  bindLoginUI();
  loadSdk()
    .then(function () {
      firebase.initializeApp(cfg);
      auth = firebase.auth();
      store = firebase.firestore();
      try { store.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
      window.OTWCloud.enabled = true;
      auth.onAuthStateChanged(onAuthChanged);
    })
    .catch(function (err) {
      console.warn('[OTW Cloud] SDK failed to load — continuing in local mode.', err);
      markLocalReady();
    });

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function loadSdk() {
    var base = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';
    return loadScript(base + 'firebase-app-compat.js')
      .then(function () { return loadScript(base + 'firebase-auth-compat.js'); })
      .then(function () { return loadScript(base + 'firebase-firestore-compat.js'); })
      .then(function () {
        if (typeof firebase === 'undefined') throw new Error('Firebase SDK unavailable');
      });
  }

  /* ── Overlays / boot gate ─────────────────────────────── */
  function markLocalReady() {
    window.__otwCloudReady = true;
    document.documentElement.classList.remove('otw-cloud-wait');
  }
  function showOverlay(id) { var n = $(id); if (n) n.classList.remove('hidden'); }
  function hideOverlay(id) { var n = $(id); if (n) n.classList.add('hidden'); }
  function revealApp() {
    markLocalReady();
    hideOverlay('loginOverlay');
    hideOverlay('pendingOverlay');
  }
  function showLogin() {
    markLocalReady();
    hideOverlay('pendingOverlay');
    renderLoginMode();
    showOverlay('loginOverlay');
  }
  function showPending() {
    markLocalReady();
    hideOverlay('loginOverlay');
    var em = $('pendingEmail');
    if (em && currentUser) em.textContent = currentUser.email || '';
    showOverlay('pendingOverlay');
  }

  /* ── Auth flow ────────────────────────────────────────── */
  function onAuthChanged(user) {
    if (!user) {
      currentUser = null; myRole = null; started = false;
      stopSync();
      showLogin();
      return;
    }
    currentUser = user;
    var ref = store.collection('roles').doc(user.uid);
    ref.get()
      .then(function (snap) {
        if (snap.exists) return snap;
        return ref.set({ email: user.email || '', role: 'pending', createdAt: new Date().toISOString() })
          .then(function () { return ref.get(); });
      })
      .then(function (snap) {
        myRole = (snap && snap.exists && snap.data().role) || 'pending';
        myMemberId = (snap && snap.exists && snap.data().memberId) || null;
        watchOwnRole(ref);
        if (myRole === 'pending') showPending();
        else enterApp();
      })
      .catch(function (err) {
        console.warn('[OTW Cloud] role lookup failed', err);
        showPending();
      });
  }

  function watchOwnRole(ref) {
    if (unsubOwnRole) unsubOwnRole();
    unsubOwnRole = ref.onSnapshot(function (snap) {
      if (!snap.exists) return;
      var r = snap.data().role;
      var mid = snap.data().memberId || null;
      if (r && r !== myRole) {
        if (myRole === 'pending' && r !== 'pending') { myRole = r; myMemberId = mid; enterApp(); }
        else if (started) location.reload(); // role changed mid-session → re-apply guards cleanly
        return;
      }
      if (mid !== myMemberId && started) location.reload(); // member link changed → re-apply cleanly
    }, function () {});
  }

  function enterApp() {
    revealApp();
    started = true;
    firstSnapshot = true;
    renderHeaderChip();
    if (myRole === 'member') { enterMemberMode(); return; }
    setSyncState('synced');
    if (myRole === 'viewer') applyReadOnly();
    startDataSync();
    if (myRole === 'admin') startRolesWatch();
    renderSettingsCard();
  }

  /* ── Member self-service: own profile only ─────────────── */
  function enterMemberMode() {
    document.body.classList.add('member-mode');
    if (!myMemberId) { renderMemberProfile(null, 'nolink'); showPage('myprofile'); return; }
    setSyncState('synced');
    if (unsubMemberProfile) unsubMemberProfile();
    unsubMemberProfile = store.collection('member_profiles').doc(myMemberId)
      .onSnapshot(function (snap) {
        if (!snap.exists) { renderMemberProfile(null, 'notready'); }
        else { currentMemberProfile = snap.data() || null; renderMemberProfile(currentMemberProfile, 'ok'); }
        showPage('myprofile');
      }, function () { renderMemberProfile(null, 'notready'); showPage('myprofile'); });
  }

  function renderMemberProfile(p, state) {
    var body = $('myProfileBody');
    if (!body) return;
    if (state === 'nolink') {
      body.innerHTML = '<div class="text-center py-10 text-slate-500 text-sm"><i class="fa-solid fa-link-slash text-3xl text-slate-300 block mb-3"></i>' + esc(t('memberLinkPending')) + '</div>';
      return;
    }
    if (state !== 'ok' || !p) {
      body.innerHTML = '<div class="text-center py-10 text-slate-500 text-sm"><i class="fa-solid fa-hourglass-half text-3xl text-slate-300 block mb-3"></i>' + esc(t('memberProfileNotReady')) + '</div>';
      return;
    }
    var txns = (p.txns || []).slice().sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? 1 : -1); });
    var income = txns.filter(function (x) { return x.type === 'income'; });
    var mk = currentMonthKey();
    var thisMonth = income.filter(function (x) { return (x.date || '').slice(0, 7) === mk; })
      .reduce(function (s, x) { return s + (+x.amount || 0); }, 0);
    body.innerHTML =
      '<div class="flex items-center gap-4 mb-5">'
      + '<div class="w-16 h-16 rounded-full bg-brand-700 text-white flex items-center justify-center text-2xl font-bold shrink-0">' + esc((p.name || '?').trim().charAt(0)) + '</div>'
      + '<div class="min-w-0"><p class="text-lg font-bold text-slate-800 truncate">' + esc(p.name || '') + '</p>'
      + '<p class="text-sm text-slate-500">' + esc(p.memberId || '') + ' • ' + esc(roleName(p.designation || 'member')) + '</p>'
      + '<p class="text-xs mt-1"><span class="pill ' + (p.status === 'active' ? 'pill-green' : 'pill-red') + '">' + (p.status === 'active' ? t('statusActive') : t('statusInactive')) + '</span></p></div></div>'
      + '<div class="grid grid-cols-3 gap-3 mb-5">'
      + '<div class="rounded-xl bg-brand-50 p-3 text-center"><p class="text-[11px] text-slate-500">' + t('myTotalPaid') + '</p><p class="font-bold text-brand-800">' + fmtMoney(+p.totalPaid || 0) + '</p></div>'
      + '<div class="rounded-xl bg-emerald-50 p-3 text-center"><p class="text-[11px] text-slate-500">' + t('myThisMonth') + '</p><p class="font-bold text-emerald-700">' + fmtMoney(thisMonth) + '</p></div>'
      + '<div class="rounded-xl bg-amber-50 p-3 text-center"><p class="text-[11px] text-slate-500">' + t('myLastPaid') + '</p><p class="font-bold text-amber-700">' + esc(p.lastPaid ? monthFullLabel(p.lastPaid) : '—') + '</p></div></div>'
      + '<p class="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">' + t('myPayments') + '</p>'
      + (txns.length ? txns.map(function (x) {
          return '<div class="flex items-center gap-2 py-2 text-sm border-t border-slate-100">'
            + '<span class="text-slate-400 text-xs whitespace-nowrap">' + fmtDate(x.date) + '</span>'
            + '<span class="flex-1 truncate text-slate-700">' + esc(x.description || catName(x.category)) + '</span>'
            + '<span class="font-semibold whitespace-nowrap ' + (x.type === 'income' ? 'text-emerald-700' : 'text-rose-600') + '">' + (x.type === 'income' ? '+' : '−') + fmtMoney(x.amount) + '</span></div>';
        }).join('') : '<p class="py-6 text-center text-slate-400 text-sm">' + t('myNoPayments') + '</p>');
  }

  function doSignOut() {
    if (!auth) return;
    auth.signOut().then(function () { location.reload(); })
      .catch(function () { location.reload(); });
  }

  /* ── Login UI ─────────────────────────────────────────── */
  function renderLoginMode() {
    var isIn = authMode === 'signin';
    var submit = $('loginSubmit'), toggle = $('loginToggle'), toggleText = $('loginToggleText'), title = $('loginTitleText');
    if (submit) submit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> ' + (isIn ? t('signIn') : t('signUp'));
    if (toggle) toggle.textContent = isIn ? t('signUp') : t('signIn');
    if (toggleText) toggleText.textContent = isIn ? t('noAccount') : t('haveAccount');
    if (title) title.textContent = isIn ? t('loginTitle') : t('signUpTitle');
    hideLoginError();
  }
  function showLoginError(msg) {
    var n = $('loginError'); if (!n) return;
    n.textContent = msg; n.classList.remove('hidden');
  }
  function hideLoginError() { var n = $('loginError'); if (n) n.classList.add('hidden'); }
  function authErrorText(err) {
    var code = (err && err.code) || '';
    if (code === 'auth/email-already-in-use') return t('errEmailInUse');
    if (code === 'auth/weak-password') return t('errWeakPass');
    if (code === 'auth/invalid-email') return t('errInvalidEmail');
    if (code.indexOf('auth/invalid-credential') === 0 || code === 'auth/wrong-password' || code === 'auth/user-not-found') return t('errInvalidLogin');
    return t('errGeneric');
  }

  function bindLoginUI() {
    var form = $('loginForm');
    if (!form || form.__bound) return;
    form.__bound = true;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!auth) return;
      var email = $('loginEmail').value.trim();
      var pass = $('loginPass').value;
      var btn = $('loginSubmit');
      btn.disabled = true; btn.style.opacity = .6;
      hideLoginError();
      var p = authMode === 'signin'
        ? auth.signInWithEmailAndPassword(email, pass)
        : auth.createUserWithEmailAndPassword(email, pass);
      p.catch(function (err) { showLoginError(authErrorText(err)); })
       .then(function () { btn.disabled = false; btn.style.opacity = 1; });
    });

    var toggle = $('loginToggle');
    if (toggle) toggle.addEventListener('click', function () {
      authMode = authMode === 'signin' ? 'signup' : 'signin';
      renderLoginMode();
    });

    var demo = $('loginDemoLink');
    if (demo) demo.addEventListener('click', function () {
      try { sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
      hideOverlay('loginOverlay');
    });
    renderLoginMode();
  }

  /* ── Firestore sync ───────────────────────────────────── */
  function startDataSync() {
    if (unsubData) return;
    var ref = store.collection('appdata').doc('main');
    unsubData = ref.onSnapshot(function (snap) {
      if (!snap.exists) { if (canWrite()) pushNow(); return; }
      var data = snap.data();
      var stamp = data._meta ? data._meta.updatedAt : '';
      if (stamp && stamp === lastPushStamp) { lastSeenStamp = stamp; firstSnapshot = false; return; }
      if (stamp && stamp === lastSeenStamp) return;
      lastSeenStamp = stamp || '';
      applyRemote(data);
      if (!firstSnapshot) showToast(t('dataUpdated'));
      firstSnapshot = false;
    }, function (err) { console.warn('[OTW Cloud] sync error', err); setSyncState('error'); });
  }

  function applyRemote(data) {
    if (!data || !data.settings || !Array.isArray(data.members)) return;
    var keepLang = currentLang; // language stays per-device
    applyingRemote = true;
    db = { settings: data.settings, members: data.members, transactions: data.transactions || [] };
    db.settings.lang = keepLang;
    recomputeAllLastPaid();
    saveDB(); // writes local cache; schedulePush() sees applyingRemote and skips
    applyingRemote = false;
    applyOrgBranding();
    buildStaticSelects();
    updateSidebarStats();
    renderCurrentPage();
  }

  function schedulePush() {
    if (!started || applyingRemote || !store || !canWrite()) return;
    setSyncState('syncing');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 800);
  }

  function pushNow() {
    if (!store || !currentUser || !canWrite()) return;
    var stamp = new Date().toISOString();
    lastPushStamp = stamp;
    store.collection('appdata').doc('main').set({
      settings: db.settings,
      members: db.members,
      transactions: db.transactions,
      _meta: { updatedAt: stamp, updatedBy: currentUser.uid, updatedByEmail: currentUser.email || '' }
    }).then(function () { setSyncState('synced'); syncMemberProfiles(false); })
      .catch(function (err) { console.warn('[OTW Cloud] push failed', err); setSyncState('error'); });
  }

  function stopSync() {
    if (unsubData) { unsubData(); unsubData = null; }
    if (unsubRoles) { unsubRoles(); unsubRoles = null; }
    if (unsubOwnRole) { unsubOwnRole(); unsubOwnRole = null; }
    if (unsubMemberProfile) { unsubMemberProfile(); unsubMemberProfile = null; }
  }

  /* ── Roles / team management (admin) ──────────────────── */
  function startRolesWatch() {
    if (unsubRoles) return;
    unsubRoles = store.collection('roles').onSnapshot(function (qs) {
      rolesList = qs.docs.map(function (d) {
        var o = d.data() || {}; o.uid = d.id; return o;
      }).sort(function (a, b) { return String(a.email || '').localeCompare(String(b.email || '')); });
      renderTeamRows();
    }, function () {});
  }

  function roleLabel(r) { return t('urole_' + (r || 'pending')); }
  /* Sync linked members' own-profile docs from the main data.
     Runs automatically after every successful admin/treasurer push,
     and manually from Settings -> Team Access. */
  function syncMemberProfiles(manual) {
    if (!store || !canWrite() || !db || !Array.isArray(db.members)) return;
    var linked = (rolesList || []).filter(function (u) { return u.role === 'member' && u.memberId; });
    if (!linked.length) { if (manual) showToast(t('memberProfilesSynced')); return; }
    var done = 0, total = linked.length;
    linked.forEach(function (u) {
      var m = db.members.find(function (x) { return x.id === u.memberId; });
      if (!m) { done++; if (done === total && manual) showToast(t('memberProfilesSynced')); return; }
      var txns = (db.transactions || []).filter(function (x) { return x.memberId === m.id; })
        .sort(function (a, b) { return a.date === b.date ? ((b.createdAt || 0) - (a.createdAt || 0)) : (a.date < b.date ? 1 : -1); })
        .slice(0, 50)
        .map(function (x) { return { date: x.date || '', amount: +x.amount || 0, type: x.type || 'income', category: x.category || '', description: x.description || '' }; });
      var totalPaid = txns.filter(function (x) { return x.type === 'income'; })
        .reduce(function (s, x) { return s + (+x.amount || 0); }, 0);
      store.collection('member_profiles').doc(m.id).set({
        uid: u.uid, memberId: m.memberId || '', name: m.name || '', designation: m.designation || 'member',
        phone: m.phone || '', status: m.status || 'active', totalPaid: totalPaid, lastPaid: m.lastPaid || null, txns: txns,
        updatedAt: new Date().toISOString()
      }).then(function () { done++; if (done === total && manual) showToast(t('memberProfilesSynced')); })
        .catch(function (e) { console.warn('[OTW Cloud] member sync failed', e); done++; if (done === total && manual) showToast(t('errGeneric'), 'error'); });
    });
  }

  function renderTeamRows() {
    var tb = $('teamTableBody');
    if (!tb) return;
    var opts = ['pending', 'viewer', 'treasurer', 'admin', 'member'];
    tb.innerHTML = rolesList.map(function (u) {
      var isSelf = currentUser && u.uid === currentUser.uid;
      var sel = '<select class="input !w-40 !py-1.5" ' + (isSelf ? 'disabled title="' + esc(t('youLabel')) + '"' : '')
        + ' onchange="OTWCloudSetRole(\'' + u.uid + '\', this.value)">'
        + opts.map(function (o) {
            return '<option value="' + o + '"' + (u.role === o ? ' selected' : '') + '>' + roleLabel(o) + '</option>';
          }).join('') + '</select>';
      var linkCell = '<span class="text-slate-300">—</span>';
      if (u.role === 'member') {
        var mems = (typeof db !== 'undefined' && db && Array.isArray(db.members)) ? db.members : [];
        linkCell = '<select class="input !w-52 !py-1.5" onchange="OTWCloudSetMemberLink(\'' + u.uid + '\', this.value)">'
          + '<option value="">' + esc(t('noMemberLinked')) + '</option>'
          + mems.map(function (m) {
              return '<option value="' + m.id + '"' + (u.memberId === m.id ? ' selected' : '') + '>' + esc(m.name) + ' (' + esc(m.memberId || '') + ')</option>';
            }).join('') + '</select>';
      }
      return '<tr><td class="font-medium">' + esc(u.email || u.uid)
        + (isSelf ? ' <span class="pill pill-green">' + t('youLabel') + '</span>' : '')
        + '</td><td>' + sel + '</td><td>' + linkCell + '</td></tr>';
    }).join('') || '<tr><td colspan="3" class="text-center text-slate-400 py-6">' + t('noData') + '</td></tr>';
  }

  /* ── Viewer read-only enforcement (UI layer; rules enforce server-side) ── */
  function applyReadOnly() {
    if (wrappedReadOnly) return;
    wrappedReadOnly = true;
    document.body.classList.add('viewer-mode');
    ['openMemberModal', 'saveMember', 'deleteMember', 'collectSubscription',
     'openTxnModal', 'saveTxn', 'deleteTxn', 'addScannedExpense',
     'saveSettings', 'loadDemoData', 'clearAllData', 'importBackup'].forEach(function (name) {
      if (typeof window[name] === 'function') {
        window[name] = function () { showToast(t('viewerReadonly'), 'error'); };
      }
    });
  }

  /* ── Header chip + sync indicator ─────────────────────── */
  function renderHeaderChip() {
    var chip = $('cloudUserChip'), local = $('localUserChip'), si = $('syncIndicator');
    if (local) local.classList.add('hidden');
    if (si) { si.classList.remove('hidden'); si.classList.add('inline-flex'); }
    if (!chip || !currentUser) return;
    var email = currentUser.email || '';
    var initial = (email.charAt(0) || 'U').toUpperCase();
    chip.classList.remove('hidden'); chip.classList.add('flex');
    chip.innerHTML =
      '<div class="w-10 h-10 rounded-full bg-gold-500 text-brand-950 flex items-center justify-center font-bold shrink-0">' + esc(initial) + '</div>'
      + '<div class="leading-tight hidden sm:block min-w-0">'
      +   '<p class="text-sm font-semibold truncate max-w-[160px]">' + esc(email) + '</p>'
      +   '<p class="text-[11px] text-brand-700 font-semibold">' + roleLabel(myRole) + '</p>'
      + '</div>'
      + '<button onclick="OTWCloud.signOut()" class="icon-btn" title="' + esc(t('logout')) + '"><i class="fa-solid fa-right-from-bracket"></i></button>';
  }

  function setSyncState(state) {
    syncState = state;
    var si = $('syncIndicator');
    if (!si) return;
    if (state === 'syncing') si.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin text-amber-500"></i><span class="hidden sm:inline">' + t('syncing') + '</span>';
    else if (state === 'error') si.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-rose-500"></i><span class="hidden sm:inline">' + t('syncError') + '</span>';
    else si.innerHTML = '<i class="fa-solid fa-cloud text-brand-600"></i><span class="hidden sm:inline">' + t('synced') + '</span>';
  }

  function refreshUI() {
    if (!window.OTWCloud.enabled) { renderSettingsCard(); return; }
    if (started) { renderHeaderChip(); setSyncState(syncState); }
    renderLoginMode();
    renderSettingsCard();
    renderTeamRows();
  }

  /* ── Settings card ────────────────────────────────────── */
  function renderSettingsCard() {
    var body = $('cloudCardBody');
    if (!body) return;

    if (!window.OTWCloud.enabled) {
      var prev = $('fbConfigText') ? $('fbConfigText').value : '';
      var existing = localCfg();
      body.innerHTML =
        '<div class="flex items-center gap-2 text-sm mb-3"><span class="pill pill-gray"><i class="fa-solid fa-mobile-screen"></i>' + t('localMode') + '</span>'
        + '<span class="text-slate-500">' + t('localModeHint') + '</span></div>'
        + '<label class="label">' + t('firebaseConfigLabel') + '</label>'
        + '<textarea id="fbConfigText" rows="5" class="input font-mono !text-xs" placeholder=\'{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}\'>'
        + esc(prev || (existing ? JSON.stringify(existing, null, 2) : '')) + '</textarea>'
        + '<button onclick="OTWCloud.saveLocalConfig()" class="btn-primary mt-3"><i class="fa-solid fa-cloud-arrow-up"></i>' + t('connectCloud') + '</button>'
        + '<p class="text-xs text-slate-400 mt-3 flex gap-1.5"><i class="fa-solid fa-circle-info mt-0.5"></i><span>' + t('cloudSetupHint') + '</span></p>';
      return;
    }

    var email = currentUser ? (currentUser.email || '') : '';
    var html =
      '<div class="flex flex-wrap items-center gap-2 text-sm mb-4">'
      + '<span class="pill pill-green"><i class="fa-solid fa-cloud"></i>' + t('cloudMode') + ' • ' + t('cloudConnected') + '</span>'
      + '<span class="text-slate-600">' + t('signedInAs') + ' <b>' + esc(email) + '</b></span>'
      + '<span class="pill pill-amber">' + roleLabel(myRole) + '</span>'
      + '<button onclick="OTWCloud.signOut()" class="btn-secondary !py-1.5 ml-auto"><i class="fa-solid fa-right-from-bracket"></i>' + t('logout') + '</button>'
      + '</div>';

    if (myRole === 'admin') {
      html += '<h4 class="font-bold text-slate-700 mb-1 flex items-center gap-2"><i class="fa-solid fa-users-gear text-brand-600"></i>' + t('teamAccess') + '</h4>'
        + '<p class="text-xs text-slate-500 mb-3">' + t('teamHint') + '</p>'
        + '<p class="text-xs text-slate-500 mb-3">' + t('linkMemberHint') + '</p>'
        + '<div class="overflow-x-auto"><table class="w-full min-w-[560px] text-sm"><thead><tr class="text-left text-slate-500 border-b border-slate-200">'
        + '<th class="th">' + t('fEmail') + '</th><th class="th">' + t('uroleLabel') + '</th><th class="th">' + t('linkMember') + '</th></tr></thead>'
        + '<tbody id="teamTableBody"></tbody></table></div>';
        + '<button onclick="OTWCloudSyncMembers()" class="btn-secondary mt-4"><i class="fa-solid fa-arrows-rotate text-brand-600"></i>' + t('syncMemberProfiles') + '</button>';
    }
    body.innerHTML = html;
    if (myRole === 'admin') renderTeamRows();
  }

  /* ── Config pasted in Settings (per-device quick connect) ── */
  function parseConfigText(text) {
    if (!text) return null;
    try { return JSON.parse(text); } catch (e) {}
    try {
      var m = String(text).match(/\{[\s\S]*\}/);
      if (!m) return null;
      return (new Function('return (' + m[0] + ')'))();
    } catch (e) { return null; }
  }
  function saveLocalConfig() {
    var ta = $('fbConfigText');
    if (!ta) return;
    var parsed = parseConfigText(ta.value);
    if (!validCfg(parsed)) { showToast(t('invalidConfig'), 'error'); return; }
    try { localStorage.setItem(CFG_KEY, JSON.stringify(parsed)); } catch (e) {}
    showToast(t('saved'));
    setTimeout(function () { location.reload(); }, 400);
  }

})();
