"use client";

import { useEffect, useMemo, useState } from "react";
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
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db, FAMILY_COLLECTION } from "../firebase";
import {
  blankFamily,
  cards,
  familyDocumentId,
  FamilyRecord,
  indexQuestions,
  childlessQuestion,
  indexScore,
  indexType,
  ownerOptions,
  PhaseKey,
  satisfactionQuestions,
} from "../data";

function ts(value: unknown) {
  if (!value) return "-";
  const date =
    typeof value === "object" && value && "toDate" in value
      ? (value as { toDate: () => Date }).toDate()
      : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function randomPin(used: Set<string>) {
  let pin = "";
  do pin = String(Math.floor(100000 + Math.random() * 900000));
  while (used.has(pin));
  used.add(pin);
  return pin;
}

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
      setError("접속번호를 만들지 못했습니다.");
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

  async function resetAccess(family: FamilyRecord) {
    if (
      !confirm(
        `${family.familyNo}번 가정의 기기 연결을 초기화할까요? 응답 내용은 지워지지 않습니다.`,
      )
    )
      return;
    const documentId =
      family._docId ||
      (await familyDocumentId(family.familyNo, family.accessPin));
    await updateDoc(doc(db, FAMILY_COLLECTION, documentId), {
      ownerUid: "",
      updatedAt: serverTimestamp(),
    });
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const summary = families.map((f) => ({
      가정번호: f.familyNo,
      접속번호: f.accessPin,
      가정이름: f.familyName,
      성인1: f.adults.adult1,
      성인2: f.adults.adult2,
      바꾸고싶은점: f.changeWish || "",
      사전상태: f.pre.status === "submitted" ? "제출완료" : "작성중",
      사후상태: f.post.status === "submitted" ? "제출완료" : "작성중",
      활동인증횟수: f.completionCount,
    }));
    const detail: Record<string, string | number>[] = [];
    families.forEach((f) =>
      (["pre", "post"] as PhaseKey[]).forEach((p) =>
        cards.forEach((c) =>
          detail.push({
            가정번호: f.familyNo,
            조사: p === "pre" ? "사전" : "사후",
            카드번호: Number(c.id),
            영역: c.category,
            역할: f[p].customTitles?.[c.id] || c.title,
            담당: ownerLabel(f, f[p].cards[c.id]),
          }),
        ),
      ),
    );
    const indexRows: Record<string, string | number>[] = [];
    families.forEach((f) =>
      (["pre", "post"] as PhaseKey[]).forEach((p) =>
        (["adult1", "adult2"] as const).forEach((who) =>
          indexQuestions.forEach((q, i) =>
            indexRows.push({
              가정번호: f.familyNo,
              조사: p === "pre" ? "사전" : "사후",
              응답자: f.adults[who],
              문항번호: i + 1,
              문항:
                i === 2 && f.familyType === "childless" ? childlessQuestion : q,
              응답: f[p].indexAnswers[who][i] || "",
            }),
          ),
        ),
      ),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(summary),
      "가정현황",
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(detail),
      "함께카드 전체",
    );
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.json_to_sheet(indexRows),
      "함께지수 전체",
    );
    XLSX.writeFile(
      book,
      `함께가정_전체자료_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
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
                {busy ? "만드는 중…" : "30가정 접속번호 만들기"}
              </button>
            )}
            <button
              className="secondary-button"
              onClick={exportExcel}
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
            <span>접속번호는 참여 가정에 개별 안내하세요.</span>
          </div>
          <div className="family-table">
            <div className="table-row labels">
              <span>번호</span>
              <span>가정</span>
              <span>접속번호</span>
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
                <code>{f.accessPin}</code>
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
          onReset={resetAccess}
        />
      )}
    </main>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span
      className={value === "submitted" ? "status submitted" : "status draft"}
    >
      {value === "submitted" ? "제출" : "작성중"}
    </span>
  );
}

function ownerLabel(family: FamilyRecord, value?: string) {
  if (!value) return "미응답";
  if (value === "adult1") return family.adults.adult1 || "성인 1";
  if (value === "adult2") return family.adults.adult2 || "성인 2";
  return ownerOptions.find((o) => o.value === value)?.label || value;
}

function FamilyDetail({
  family,
  phase,
  setPhase,
  onClose,
  onCompletion,
  onReset,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  setPhase: (p: PhaseKey) => void;
  onClose: () => void;
  onCompletion: (f: FamilyRecord, v: number) => void;
  onReset: (f: FamilyRecord) => void;
}) {
  const data = family[phase],
    score1 = indexScore(data.indexAnswers.adult1),
    score2 = indexScore(data.indexAnswers.adult2);
  const grouped = useMemo(
    () =>
      Array.from(new Set(cards.map((c) => c.category))).map((category) => ({
        category,
        cards: cards.filter((c) => c.category === category),
      })),
    [],
  );
  return (
    <div
      className="detail-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="detail-panel">
        <header>
          <div>
            <span>{String(family.familyNo).padStart(2, "0")}번 가정</span>
            <h2>{family.familyName || "미등록 가정"}</h2>
            <p>
              {family.adults.adult1 || "성인 1 미등록"} ·{" "}
              {family.adults.adult2 || "성인 2 미등록"} · 접속번호{" "}
              <b>{family.accessPin}</b>
            </p>
          </div>
          <button aria-label="닫기" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-tools">
          <label>
            활동 인증 횟수
            <input
              type="number"
              min="0"
              value={family.completionCount || 0}
              onChange={(e) => onCompletion(family, Number(e.target.value))}
            />
          </label>
          <button onClick={() => onReset(family)}>접속 기기 초기화</button>
        </div>
        <div className="phase-tabs">
          <button
            className={phase === "pre" ? "selected" : ""}
            onClick={() => setPhase("pre")}
          >
            사전 진단 <Status value={family.pre.status} />
          </button>
          <button
            className={phase === "post" ? "selected" : ""}
            onClick={() => setPhase("post")}
          >
            사후 진단 <Status value={family.post.status} />
          </button>
        </div>
        {phase === "pre" && (
          <section className="detail-section">
            <h3>우리 가족이 바꿔보고 싶은 점</h3>
            <div className="feedback-box">
              <p>{family.changeWish || "작성 내용 없음"}</p>
            </div>
          </section>
        )}
        <section className="detail-section">
          <h3>우리집 함께지수</h3>
          <div className="mini-score">
            <div>
              <span>{family.adults.adult1 || "성인 1"}</span>
              <strong>{score1}점</strong>
              <small>{indexType(score1)}</small>
            </div>
            <div>
              <span>{family.adults.adult2 || "성인 2"}</span>
              <strong>{score2}점</strong>
              <small>{indexType(score2)}</small>
            </div>
          </div>
          <div className="index-detail">
            <div className="index-row labels">
              <span>문항</span>
              <b>{family.adults.adult1 || "성인 1"}</b>
              <b>{family.adults.adult2 || "성인 2"}</b>
            </div>
            {indexQuestions.map((q, i) => (
              <div className="index-row" key={q}>
                <span>
                  {i + 1}.{" "}
                  {i === 2 && family.familyType === "childless"
                    ? childlessQuestion
                    : q}
                </span>
                <b>{data.indexAnswers.adult1[i] || "-"}</b>
                <b>{data.indexAnswers.adult2[i] || "-"}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="detail-section">
          <h3>일주일 시간</h3>
          <div className="detail-time">
            <span />
            <b>{family.adults.adult1}</b>
            <b>{family.adults.adult2}</b>
            <span>집안일·돌봄</span>
            <b>{data.times.adult1.housework || "-"}시간</b>
            <b>{data.times.adult2.housework || "-"}시간</b>
            <span>가족 챙김</span>
            <b>{data.times.adult1.mental || "-"}시간</b>
            <b>{data.times.adult2.mental || "-"}시간</b>
            <span>혼자 쉼</span>
            <b>{data.times.adult1.rest || "-"}시간</b>
            <b>{data.times.adult2.rest || "-"}시간</b>
          </div>
        </section>
        <section className="detail-section">
          <h3>함께카드 100장</h3>
          {grouped.map((group) => (
            <details key={group.category}>
              <summary>
                {group.category}
                <span>
                  {group.cards.filter((c) => data.cards[c.id]).length}/
                  {group.cards.length}
                </span>
              </summary>
              <div className="card-detail-list">
                {group.cards.map((card) => (
                  <div key={card.id}>
                    <span>
                      <small>{card.id}</small>
                      {data.customTitles?.[card.id] || card.title}
                    </span>
                    <b>{ownerLabel(family, data.cards[card.id])}</b>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </section>
        {phase === "post" && (
          <section className="detail-section">
            <h3>활동 만족도</h3>
            {satisfactionQuestions.map((q, i) => (
              <div className="satisfaction-detail" key={q}>
                <span>
                  {i + 1}. {q}
                </span>
                <b>{data.satisfaction.ratings[i] || "-"}점</b>
              </div>
            ))}
            <div className="feedback-box">
              <b>자유 의견</b>
              <p>{data.satisfaction.feedback || "작성 내용 없음"}</p>
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
