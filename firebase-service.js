(function () {
  "use strict";

  const SDK_VERSION = "12.16.0";
  const LOCAL_REPORTS_KEY = "seogu-safety-map-demo-reports-v2";
  let modulesPromise = null;
  let contextPromise = null;

  function isConfigured() {
    const config = window.SAFETY_MAP_FIREBASE_CONFIG || {};
    return Boolean(
      config.apiKey &&
      config.projectId &&
      !String(config.apiKey).startsWith("REPLACE_") &&
      !String(config.projectId).startsWith("REPLACE_")
    );
  }

  function loadModules() {
    if (!modulesPromise) {
      modulesPromise = Promise.all([
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`)
      ]).then(([appModule, firestoreModule, authModule]) => ({ appModule, firestoreModule, authModule }));
    }
    return modulesPromise;
  }

  async function getContext() {
    if (!isConfigured()) return null;
    if (!contextPromise) {
      contextPromise = loadModules().then(({ appModule, firestoreModule, authModule }) => {
        const app = appModule.getApps().length
          ? appModule.getApp()
          : appModule.initializeApp(window.SAFETY_MAP_FIREBASE_CONFIG);
        return {
          app,
          db: firestoreModule.getFirestore(app),
          auth: authModule.getAuth(app),
          firestore: firestoreModule,
          authModule
        };
      });
    }
    return contextPromise;
  }

  async function addReport(report) {
    const context = await getContext();
    if (!context) return addLocalReport(report);
    const { db, firestore } = context;
    const document = await firestore.addDoc(firestore.collection(db, "reports"), {
      dong: report.dong,
      type: report.type,
      note: report.note,
      lat: Number(report.lat),
      lon: Number(report.lon),
      status: "received",
      source: "citizen-web",
      createdAt: firestore.serverTimestamp()
    });
    return { id: document.id, createdAt: new Date().toISOString() };
  }

  async function listenReports(onData, onError) {
    const context = await getContext();
    if (!context) {
      onData(readLocalReports());
      const listener = () => onData(readLocalReports());
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    }
    const { db, firestore } = context;
    const reportsQuery = firestore.query(
      firestore.collection(db, "reports"),
      firestore.orderBy("createdAt", "desc")
    );
    return firestore.onSnapshot(reportsQuery, (snapshot) => {
      onData(snapshot.docs.map((item) => normalizeReport(item.id, item.data())));
    }, onError);
  }

  async function updateReportStatus(id, status, reviewerEmail) {
    const context = await getContext();
    if (!context) {
      const reports = readLocalReports();
      const report = reports.find((item) => item.id === id);
      if (report) {
        report.status = status;
        report.updatedAt = new Date().toISOString();
        writeLocalReports(reports);
      }
      return;
    }
    const { db, firestore } = context;
    await firestore.updateDoc(firestore.doc(db, "reports", id), {
      status,
      reviewerEmail: reviewerEmail || "",
      updatedAt: firestore.serverTimestamp()
    });
  }

  async function onAuthChanged(callback) {
    const context = await getContext();
    if (!context) {
      callback({ demo: true, uid: "demo-admin", email: "시범 관리자" });
      return () => {};
    }
    return context.authModule.onAuthStateChanged(context.auth, callback);
  }

  async function signInAdmin() {
    const context = await getContext();
    if (!context) return { user: { demo: true, uid: "demo-admin", email: "시범 관리자" } };
    const provider = new context.authModule.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return context.authModule.signInWithPopup(context.auth, provider);
  }

  async function signOutAdmin() {
    const context = await getContext();
    if (context) await context.authModule.signOut(context.auth);
  }

  async function checkAdmin(user) {
    if (!user) return false;
    if (user.demo) return true;
    const context = await getContext();
    const snapshot = await context.firestore.getDoc(context.firestore.doc(context.db, "admins", user.uid));
    return snapshot.exists() && snapshot.data().active !== false;
  }

  function normalizeReport(id, data) {
    return {
      id,
      dong: String(data.dong || ""),
      type: String(data.type || "other"),
      note: String(data.note || ""),
      lat: Number(data.lat),
      lon: Number(data.lon),
      status: String(data.status || "received"),
      createdAt: timestampToIso(data.createdAt),
      updatedAt: timestampToIso(data.updatedAt),
      reviewerEmail: String(data.reviewerEmail || "")
    };
  }

  function timestampToIso(value) {
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    if (typeof value === "string") return value;
    return new Date().toISOString();
  }

  function addLocalReport(report) {
    const reports = readLocalReports();
    const saved = {
      ...report,
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "received",
      createdAt: new Date().toISOString()
    };
    reports.unshift(saved);
    writeLocalReports(reports);
    return saved;
  }

  function readLocalReports() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_REPORTS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalReports(reports) {
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
  }

  window.SafetyMapFirebase = {
    isConfigured,
    addReport,
    listenReports,
    updateReportStatus,
    onAuthChanged,
    signInAdmin,
    signOutAdmin,
    checkAdmin
  };
})();
