(function () {
  "use strict";

  const SDK_VERSION = "12.16.0";
  const LOCAL_REPORTS_KEY = "seogu-safety-map-demo-reports-v2";
  const LOCAL_FEATURES_KEY = "seogu-safety-map-demo-features-v1";
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
        import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`)
      ]).then(([appModule, firestoreModule]) => ({ appModule, firestoreModule }));
    }
    return modulesPromise;
  }

  async function getContext() {
    if (!isConfigured()) return null;
    if (!contextPromise) {
      contextPromise = loadModules().then(({ appModule, firestoreModule }) => {
        const app = appModule.getApps().length
          ? appModule.getApp()
          : appModule.initializeApp(window.SAFETY_MAP_FIREBASE_CONFIG);
        return {
          app,
          db: firestoreModule.getFirestore(app),
          firestore: firestoreModule
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

  async function updateReport(id, changes, reviewerEmail) {
    const clean = {
      dong: String(changes.dong || ""),
      type: String(changes.type || "other"),
      note: String(changes.note || ""),
      lat: Number(changes.lat),
      lon: Number(changes.lon),
      status: String(changes.status || "received")
    };
    const context = await getContext();
    if (!context) {
      const reports = readLocalReports();
      const report = reports.find((item) => item.id === id);
      if (report) Object.assign(report, clean, {
        reviewerEmail: reviewerEmail || "시범 관리자",
        updatedAt: new Date().toISOString()
      });
      writeLocalReports(reports);
      return;
    }
    const { db, firestore } = context;
    await firestore.updateDoc(firestore.doc(db, "reports", id), {
      ...clean,
      reviewerEmail: reviewerEmail || "",
      updatedAt: firestore.serverTimestamp()
    });
  }

  async function setReportDeleted(id, deleted, reviewerEmail) {
    const context = await getContext();
    if (!context) {
      const reports = readLocalReports();
      const report = reports.find((item) => item.id === id);
      if (report) Object.assign(report, {
        deleted: Boolean(deleted),
        deletedAt: deleted ? new Date().toISOString() : "",
        deletedBy: deleted ? (reviewerEmail || "시범 관리자") : "",
        reviewerEmail: reviewerEmail || "시범 관리자",
        updatedAt: new Date().toISOString()
      });
      writeLocalReports(reports);
      return;
    }
    const { db, firestore } = context;
    await firestore.updateDoc(firestore.doc(db, "reports", id), {
      deleted: Boolean(deleted),
      deletedAt: deleted ? firestore.serverTimestamp() : null,
      deletedBy: deleted ? (reviewerEmail || "") : "",
      reviewerEmail: reviewerEmail || "",
      updatedAt: firestore.serverTimestamp()
    });
  }

  async function listenMapFeatures(onData, onError) {
    const context = await getContext();
    if (!context) {
      onData(readLocalFeatures());
      const listener = (event) => {
        if (!event.key || event.key === LOCAL_FEATURES_KEY) onData(readLocalFeatures());
      };
      window.addEventListener("storage", listener);
      return () => window.removeEventListener("storage", listener);
    }
    const { db, firestore } = context;
    return firestore.onSnapshot(firestore.collection(db, "mapFeatures"), (snapshot) => {
      onData(snapshot.docs.map((item) => normalizeMapFeature(item.id, item.data())));
    }, onError);
  }

  async function saveMapFeature(feature, previous, editorEmail) {
    const clean = normalizeMapFeature(feature.id, feature);
    const context = await getContext();
    if (!context) {
      const features = readLocalFeatures();
      const index = features.findIndex((item) => item.id === clean.id);
      clean.updatedAt = new Date().toISOString();
      clean.updatedBy = editorEmail || "시범 관리자";
      if (index >= 0) features[index] = clean;
      else features.push(clean);
      writeLocalFeatures(features);
      return clean;
    }

    const { db, firestore } = context;
    const batch = firestore.writeBatch(db);
    const featureRef = firestore.doc(db, "mapFeatures", clean.id);
    const historyRef = firestore.doc(firestore.collection(db, "mapFeatureHistory"));
    batch.set(historyRef, {
      featureId: clean.id,
      previous: previous ? normalizeMapFeature(clean.id, previous) : null,
      changedTo: clean,
      editedAt: firestore.serverTimestamp(),
      editedBy: editorEmail || ""
    });
    batch.set(featureRef, {
      ...clean,
      updatedAt: firestore.serverTimestamp(),
      updatedBy: editorEmail || ""
    });
    await batch.commit();
    return clean;
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
      reviewerEmail: String(data.reviewerEmail || ""),
      deleted: data.deleted === true,
      deletedAt: timestampToIso(data.deletedAt, ""),
      deletedBy: String(data.deletedBy || "")
    };
  }

  function normalizeMapFeature(id, data) {
    return {
      id: String(id || data.id || ""),
      type: ["return", "alley", "parcel", "vending"].includes(data.type) ? data.type : "return",
      geometry: data.geometry === "point" || ["parcel", "vending"].includes(data.type) ? "point" : "line",
      dong: String(data.dong || ""),
      name: String(data.name || "이름 없는 안전시설"),
      location: String(data.location || ""),
      points: Array.isArray(data.points)
        ? data.points.map((point) => ({ lat: Number(point.lat), lon: Number(point.lon) }))
            .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
        : [],
      active: data.active !== false,
      baseFeature: data.baseFeature === true,
      updatedAt: timestampToIso(data.updatedAt),
      updatedBy: String(data.updatedBy || "")
    };
  }

  function timestampToIso(value, fallback) {
    if (value && typeof value.toDate === "function") return value.toDate().toISOString();
    if (typeof value === "string") return value;
    return fallback === undefined ? new Date().toISOString() : fallback;
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

  function readLocalFeatures() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_FEATURES_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalFeatures(features) {
    localStorage.setItem(LOCAL_FEATURES_KEY, JSON.stringify(features));
  }

  // ── 함께가게: 접속코드 경로(hamkkeVault/{코드}) 아래에 점포 명단과 결과를 둡니다. ──
  const LOCAL_HAMKKE_KEY = "seogu-safety-map-demo-hamkke-v1";

  function validCode(code) {
    return /^[0-9]{4,8}$/.test(String(code || ""));
  }

  function readLocalHamkke(code) {
    try {
      const all = JSON.parse(localStorage.getItem(LOCAL_HAMKKE_KEY) || "{}");
      return all[code] || null;
    } catch (_) {
      return null;
    }
  }

  function writeLocalHamkke(code, vault) {
    try {
      const all = JSON.parse(localStorage.getItem(LOCAL_HAMKKE_KEY) || "{}");
      all[code] = vault;
      localStorage.setItem(LOCAL_HAMKKE_KEY, JSON.stringify(all));
    } catch (_) {
      // 시범 실행에서만 쓰는 저장소이므로 실패해도 넘어갑니다.
    }
    window.dispatchEvent(new CustomEvent("hamkke-local-change"));
  }

  async function hamkkeCheckCode(code) {
    if (!validCode(code)) return false;
    const context = await getContext();
    if (!context) {
      const vault = readLocalHamkke(code);
      return Boolean(vault && vault.active);
    }
    const { db, firestore } = context;
    const snapshot = await firestore.getDoc(firestore.doc(db, "hamkkeVault", code));
    return snapshot.exists() && snapshot.data().active === true;
  }

  async function listenHamkke(code, onStores, onResults, onError) {
    const context = await getContext();
    if (!context) {
      const emit = () => {
        const vault = readLocalHamkke(code) || { stores: {}, results: {} };
        onStores(Object.values(vault.stores || {}));
        onResults(Object.values(vault.results || {}));
      };
      emit();
      window.addEventListener("hamkke-local-change", emit);
      window.addEventListener("storage", emit);
      return () => {
        window.removeEventListener("hamkke-local-change", emit);
        window.removeEventListener("storage", emit);
      };
    }
    const { db, firestore } = context;
    const stopStores = firestore.onSnapshot(
      firestore.collection(db, "hamkkeVault", code, "stores"),
      (snapshot) => onStores(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }))),
      onError
    );
    const stopResults = firestore.onSnapshot(
      firestore.collection(db, "hamkkeVault", code, "results"),
      (snapshot) => onResults(snapshot.docs.map((item) => {
        const data = item.data();
        return { ...data, id: item.id, updatedAt: timestampToIso(data.updatedAt, "") };
      })),
      onError
    );
    return () => { stopStores(); stopResults(); };
  }

  // section은 "visit" 또는 "phone". 해당 부분만 통째로 바꾸고 나머지는 그대로 둡니다.
  async function saveHamkkeSection(code, store, section, data, editor) {
    if (!validCode(code)) throw new Error("접속코드가 올바르지 않습니다.");
    if (!["visit", "phone"].includes(section)) throw new Error("저장할 항목이 올바르지 않습니다.");
    const payload = {
      storeId: String(store.id),
      storeName: String(store.name || ""),
      [section]: data,
      updatedBy: String(editor || "시민참여단")
    };
    const context = await getContext();
    if (!context) {
      const vault = readLocalHamkke(code) || { active: true, stores: {}, results: {} };
      const previous = (vault.results || {})[store.id] || {};
      vault.results = vault.results || {};
      vault.results[store.id] = { ...previous, ...payload, id: store.id, updatedAt: new Date().toISOString() };
      writeLocalHamkke(code, vault);
      return;
    }
    const { db, firestore } = context;
    const write = firestore.setDoc(
      firestore.doc(db, "hamkkeVault", code, "results", String(store.id)),
      { ...payload, updatedAt: firestore.serverTimestamp() },
      { mergeFields: ["storeId", "storeName", section, "updatedBy", "updatedAt"] }
    );
    // 신호가 약한 곳에서는 응답이 늦을 수 있어, 일정 시간이 지나면 '전송 대기'로 알려줍니다.
    const timeout = new Promise((resolve) => setTimeout(() => resolve("pending"), 9000));
    return Promise.race([write.then(() => "saved"), timeout]);
  }

  async function saveHamkkeStores(code, stores) {
    if (!validCode(code)) throw new Error("접속코드는 숫자 4~8자리로 정해주세요.");
    const clean = stores.map((store) => ({
      id: String(store.id),
      division: String(store.division || ""),
      no: Number(store.no) || 0,
      round: store.round === "done" ? "done" : "visit",
      leader: String(store.leader || ""),
      name: String(store.name || ""),
      owner: String(store.owner || ""),
      phone: String(store.phone || ""),
      address: String(store.address || ""),
      dong: String(store.dong || ""),
      category: String(store.category || ""),
      campaign: ["1차", "2차 예정"].includes(store.campaign) ? store.campaign : "",
      frame: ["수령", "미수령"].includes(store.frame) ? store.frame : "",
      note: String(store.note || "").slice(0, 200),
      active: store.active !== false
    }));
    const context = await getContext();
    if (!context) {
      const vault = readLocalHamkke(code) || { stores: {}, results: {} };
      vault.active = true;
      vault.stores = vault.stores || {};
      clean.forEach((store) => { vault.stores[store.id] = store; });
      writeLocalHamkke(code, vault);
      return clean.length;
    }
    const { db, firestore } = context;
    for (let start = 0; start < clean.length; start += 400) {
      const batch = firestore.writeBatch(db);
      clean.slice(start, start + 400).forEach((store) => {
        batch.set(firestore.doc(db, "hamkkeVault", code, "stores", store.id), {
          ...store,
          updatedAt: firestore.serverTimestamp()
        });
      });
      if (start === 0) {
        batch.set(firestore.doc(db, "hamkkeVault", code), {
          active: true,
          updatedAt: firestore.serverTimestamp()
        });
      }
      await batch.commit();
    }
    return clean.length;
  }

  window.SafetyMapFirebase = {
    hamkkeCheckCode,
    listenHamkke,
    saveHamkkeSection,
    saveHamkkeStores,
    isConfigured,
    addReport,
    listenReports,
    updateReportStatus,
    updateReport,
    setReportDeleted,
    listenMapFeatures,
    saveMapFeature
  };
})();
