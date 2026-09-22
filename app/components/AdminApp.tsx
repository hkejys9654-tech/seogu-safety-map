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
} from "firebase/firestore";
import { auth, db, FAMILY_COLLECTION } from "../firebase";
import {
  blankFamily,
  familyDocumentId,
  FamilyRecord,
  hasAdditionalResponse,
  hasSecondAdult,
  hasTwoPersonReport,
  PhaseKey,
} from "../data";
import { exportExcel } from "./admin/exportExcel";
import { FamilyDetail } from "./admin/FamilyDetail";
import { FamilyEdits } from "./admin/FamilyEditForm";
import { Status, ts } from "./admin/helpers";

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [selected, setSelected] = useState<FamilyRecord | null>(null);
  const [phase, setPhase] = useState<PhaseKey>("pre");
  const [error, setError] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(auth, async (current) => {
        setUser(current);
        if (!current || current.isAnonymous) {
          setAuthorized(false);
          return;
        }
        try {
          const admin = await getDoc(doc(db, "admins", current.uid));
          setAuthorized(admin.exists() && admin.data().active !== false);
        } catch {
          setAuthorized(false);
          setError("관리자 권한을 확인하지 못했습니다. 다시 로그인해주세요.");
        }
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
      if (auth.currentUser) await signOut(auth);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      const admin = await getDoc(doc(db, "admins", credential.user.uid));
      if (!admin.exists() || admin.data().active === false) {
        await signOut(auth);
        setError("등록된 관리자 계정이 아닙니다.");
      }
    } catch {
      setError("로그인 창이 닫혔거나 로그인하지 못했습니다.");
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

  async function saveFamily(family: FamilyRecord, edits: FamilyEdits) {
    if (!family._docId) return;
    setError("");
    try {
      await updateDoc(doc(db, FAMILY_COLLECTION, family._docId), {
        ...edits,
        updatedAt: serverTimestamp(),
      });
    } catch {
      setError("수정 내용을 저장하지 못했습니다.");
      throw new Error("save-failed");
    }
  }

  async function deleteSubmitter(family: FamilyRecord) {
    if (!family._docId) return;
    if (
      !confirm(
        `${family.familyNo}번 가정의 제출자와 모든 응답을 삭제할까요? 삭제한 내용은 되돌릴 수 없습니다.`,
      )
    )
      return;
    setError("");
    try {
      if (family.familyPhoto) await deleteFamilyPhoto(family, false);
      const empty = blankFamily(family.familyNo, family.accessPin);
      await updateDoc(doc(db, FAMILY_COLLECTION, family._docId), {
        applicantName: "",
        lastVisitorUid: "",
        familyName: empty.familyName,
        familyType: empty.familyType,
        adults: empty.adults,
        children: empty.children,
        changeWish: empty.changeWish,
        pre: empty.pre,
        post: empty.post,
        completionCount: 0,
        updatedAt: serverTimestamp(),
      });
      setSelected(null);
    } catch {
      setError("제출자 자료를 삭제하지 못했습니다.");
    }
  }

  async function deleteFamilyPhoto(
    family: FamilyRecord,
    askForConfirmation = true,
  ) {
    if (!family.familyPhoto) return;
    if (
      askForConfirmation &&
      !confirm(`${family.familyNo}번 가정의 가족사진을 삭제할까요?`)
    )
      return;
    const token = await auth.currentUser?.getIdToken();
    const name = family.applicantName || family.authorizedNames?.[0] || "";
    if (!token || !name) throw new Error("photo-delete-unavailable");
    const response = await fetch("/api/family-photo", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ familyNo: family.familyNo, name }),
    });
    if (!response.ok) {
      setError("가족사진을 삭제하지 못했습니다.");
      throw new Error("photo-delete-failed");
    }
  }

  const submittedPre = families.filter(
    (f) => f.pre.status === "submitted",
  ).length;
  const submittedPost = families.filter(
    (f) => f.post.status === "submitted",
  ).length;

  if (!user || !authorized) {
    return (
      <main className="admin-login">
        <section>
          <img src="/assets/seo-gu-symbol.png" alt="서구" />
          <span>함께가정</span>
          <h1>관리자 화면</h1>
          <p>등록된 관리자 구글 계정으로 로그인해 주세요.</p>
          {error && <p className="error-message">{error}</p>}
          <button className="primary-button" onClick={login}>
            Google로 관리자 로그인
          </button>
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
            <small>{user.email || "관리자"}</small>
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
            <span className="section-kicker">함께가정 운영 관리</span>
            <h1>참여자 현황</h1>
            <p>가정을 누르면 카드 선택과 진단 내용을 자세히 볼 수 있어요.</p>
          </div>
          <div className="admin-actions">
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
              <small>가정</small>
            </strong>
          </article>
          <article>
            <span>사전 제출</span>
            <strong>
              {submittedPre}
              <small>/{families.length}</small>
            </strong>
          </article>
          <article>
            <span>사후 제출</span>
            <strong>
              {submittedPost}
              <small>/{families.length}</small>
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
              <span>추가응답</span>
              <span>사진</span>
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
                  {f.applicantName || f.adults.adult1 || "미등록"}
                  <small>
                    {f.adults.adult1 &&
                      [f.adults.adult1, f.adults.adult2]
                        .filter(Boolean)
                        .join(" · ")}
                  </small>
                </span>
                <span>{f.applicantName || "미입력"}</span>
                <Status value={f.pre.status} />
                <Status value={f.post.status} />
                <span className="additional-status">
                  {!hasSecondAdult(f)
                    ? "1인 가정"
                    : hasTwoPersonReport(f)
                      ? "사전·사후"
                      : hasAdditionalResponse(f, "pre") ||
                          hasAdditionalResponse(f, "post")
                        ? "일부 참여"
                        : "선택 미참여"}
                </span>
                <span
                  className={`photo-status ${f.familyPhoto ? "registered" : ""}`}
                >
                  {f.familyPhoto ? "등록" : "미등록"}
                </span>
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
          onSave={saveFamily}
          onDelete={deleteSubmitter}
          onDeletePhoto={(family) => deleteFamilyPhoto(family)}
        />
      )}
    </main>
  );
}
