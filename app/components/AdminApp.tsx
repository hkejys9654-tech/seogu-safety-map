"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, FAMILY_COLLECTION } from "../firebase";
import { blankFamily, familyDocumentId, FamilyRecord, PhaseKey } from "../data";
import { exportExcel } from "./admin/exportExcel";
import { FamilyDetail } from "./admin/FamilyDetail";
import { randomPin, Status, ts } from "./admin/helpers";

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [selected, setSelected] = useState<FamilyRecord | null>(null);
  const [phase, setPhase] = useState<PhaseKey>("pre");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (current) => {
        setUser(current);
        if (!current || current.isAnonymous) {
          setAuthorized(false);
          return;
        }
        const admin = await getDoc(doc(db, "admins", current.uid));
        setAuthorized(admin.exists());
      }),
    [],
  );

  useEffect(() => {
    if (!authorized) return;
    return onSnapshot(
      collection(db, FAMILY_COLLECTION),
      (snapshot) => {
        const list = snapshot.docs
          .map((item) => ({
            ...(item.data() as FamilyRecord),
            _docId: item.id,
          }))
          .sort((a, b) => a.familyNo - b.familyNo);
        setFamilies(list);
        setSelected((current) =>
          current
            ? list.find((f) => f.familyNo === current.familyNo) || null
            : null,
        );
      },
      () =>
        setError(
          "가정 자료를 불러오지 못했습니다. 관리자 권한을 확인해주세요.",
        ),
    );
  }, [authorized]);

  async function login() {
    setError("");
    try {
      if (auth.currentUser?.isAnonymous) await signOut(auth);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setError("로그인 창이 닫혔거나 로그인하지 못했습니다.");
    }
  }

  async function createFamilies() {
    setBusy(true);
    setError("");
    try {
      const batch = writeBatch(db),
        used = new Set(families.map((f) => f.accessPin));
      let created = 0;
      for (let no = 1; no <= 30; no++) {
        if (families.some((f) => f.familyNo === no)) continue;
        const data = blankFamily(no, randomPin(used));
        const documentId = await familyDocumentId(no, data.accessPin);
        batch.set(doc(db, FAMILY_COLLECTION, documentId), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
      if (created) await batch.commit();
    } catch {
      setError("가정을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function changeCompletion(family: FamilyRecord, value: number) {
    const documentId =
      family._docId ||
      (await familyDocumentId(family.familyNo, family.accessPin));
    await updateDoc(doc(db, FAMILY_COLLECTION, documentId), {
      completionCount: Math.max(0, value),
      updatedAt: serverTimestamp(),
    });
  }

  const submittedPre = families.filter(
    (f) => f.pre.status === "submitted",
  ).length;
  const submittedPost = families.filter(
    (f) => f.post.status === "submitted",
  ).length;

  if (!user || user.isAnonymous || !authorized) {
    return (
      <main className="admin-login">
        <section>
          <img src="/assets/seo-gu-symbol.png" alt="서구" />
          <span>함께가정</span>
          <h1>관리자 화면</h1>
          <p>등록된 관리자 구글 계정으로 로그인해주세요.</p>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" onClick={login}>
            Google로 관리자 로그인
          </button>
          {user && !user.isAnonymous && authorized === false && (
            <>
              <p className="unauthorized">
                이 계정에는 관리자 권한이 없습니다.
                <br />
                <small>{user.email}</small>
              </p>
              <button className="text-button" onClick={() => signOut(auth)}>
                다른 계정으로 로그인
              </button>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <img src="/assets/seo-gu-symbol.png" alt="" />
          <span>
            <b>함께가정 관리자</b>
            <small>{user.email}</small>
          </span>
        </div>
        <nav>
          <a href="/" target="_blank">
            참여자 화면
          </a>
          <button onClick={() => signOut(auth)}>로그아웃</button>
        </nav>
      </header>
      <div className="admin-content">
        <div className="admin-title">
          <div>
            <span className="section-kicker">가족별 관리</span>
            <h1>참여 현황</h1>
            <p>가정을 누르면 카드 선택과 진단 내용을 자세히 볼 수 있어요.</p>
          </div>
          <div className="admin-actions">
            {families.length < 30 && (
              <button
                className="primary-button"
                onClick={createFamilies}
                disabled={busy}
              >
                {busy ? "만드는 중…" : "30가정 만들기"}
              </button>
            )}
            <button
              className="secondary-button"
              onClick={() => exportExcel(families)}
              disabled={!families.length}
            >
              엑셀 내려받기
            </button>
          </div>
        </div>
        {error && <p className="floating-notice">{error}</p>}
        <section className="stat-grid">
          <article>
            <span>등록 가정</span>
            <strong>
              {families.length}
              <small>/30</small>
            </strong>
          </article>
          <article>
            <span>사전 제출</span>
            <strong>
              {submittedPre}
              <small>/30</small>
            </strong>
          </article>
          <article>
            <span>사후 제출</span>
            <strong>
              {submittedPost}
              <small>/30</small>
            </strong>
          </article>
          <article>
            <span>활동 인증</span>
            <strong>
              {families.reduce((s, f) => s + (f.completionCount || 0), 0)}
              <small>회</small>
            </strong>
          </article>
        </section>
        <section className="family-table-card">
          <div className="table-head">
            <b>가정별 현황</b>
            <span>가정별 신청자와 제출 현황을 확인할 수 있어요.</span>
          </div>
          <div className="family-table">
            <div className="table-row labels">
              <span>번호</span>
              <span>가정</span>
              <span>신청자</span>
              <span>사전</span>
              <span>사후</span>
              <span>인증</span>
              <span>최근 저장</span>
            </div>
            {families.map((f) => (
              <button
                className="table-row"
                key={f.familyNo}
                onClick={() => {
                  setSelected(f);
                  setPhase("pre");
                }}
              >
                <b>{String(f.familyNo).padStart(2, "0")}</b>
                <span>
                  {f.familyName || "미등록"}
                  <small>
                    {f.adults.adult1 &&
                      `${f.adults.adult1} · ${f.adults.adult2}`}
                  </small>
                </span>
                <span>{f.applicantName || "미입력"}</span>
                <Status value={f.pre.status} />
                <Status value={f.post.status} />
                <span>{f.completionCount || 0}회</span>
                <span>{ts(f.updatedAt)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
      {selected && (
        <FamilyDetail
          family={selected}
          phase={phase}
          setPhase={setPhase}
          onClose={() => setSelected(null)}
          onCompletion={changeCompletion}
        />
      )}
    </main>
  );
}
