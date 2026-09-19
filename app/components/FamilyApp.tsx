"use client";

import { useState } from "react";
import { signInAnonymously, User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db, FAMILY_COLLECTION } from "../firebase";
import {
  FamilyPhoto,
  FamilyRecord,
  hasAdditionalResponse,
  hasCompleteIndex,
  PhaseKey,
} from "../data";
import {
  cloneFamily,
  formatError,
  normalizeAccessName,
} from "./family/helpers";
import { Header, Progress } from "./family/Shared";
import { CardSurvey, FamilyInfo } from "./family/SetupAndCards";
import { IndexSurvey, Satisfaction, TimeSurvey } from "./family/Questions";
import { AdditionalResult, PromiseSurvey, Result } from "./family/Finish";
import { FamilyPhotoCard } from "./family/FamilyPhotoCard";

const phases: {
  key: PhaseKey;
  title: string;
  period: string;
  image: string;
}[] = [
  {
    key: "pre",
    title: "사전 진단",
    period: "활동 시작 전",
    image: "/assets/haeoni-yellow.png",
  },
  {
    key: "post",
    title: "사후 진단",
    period: "30일 활동 후",
    image: "/assets/haeoni-suit-point.png",
  },
];

export default function FamilyApp() {
  const [familyNo, setFamilyNo] = useState(() =>
    typeof window === "undefined"
      ? ""
      : sessionStorage.getItem("hamkkeFamilyNo") || "",
  );
  const [applicantName, setApplicantName] = useState(() =>
    typeof window === "undefined"
      ? ""
      : sessionStorage.getItem("hamkkeApplicantName") || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [phase, setPhase] = useState<PhaseKey | null>(null);
  const [step, setStep] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("저장됨");
  const [respondentRole, setRespondentRole] = useState<
    "representative" | "additional"
  >("representative");

  async function enter() {
    const no = Number(familyNo);
    const name = applicantName.trim();
    if (!Number.isInteger(no) || no < 1 || no > 99 || !name) {
      setNotice("가정 번호와 엄마 또는 아빠 이름을 입력해주세요.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const active = auth.currentUser || (await signInAnonymously(auth)).user;
      const matches = await getDocs(
        query(
          collection(db, FAMILY_COLLECTION),
          where("familyNo", "==", no),
          limit(1),
        ),
      );
      const snapshot = matches.docs[0];
      if (!snapshot) throw new Error("not-found");
      const stored = snapshot.data() as FamilyRecord;
      const enteredName = normalizeAccessName(name);
      const allowedNames = [
        ...(stored.authorizedNames || []),
        stored.applicantName || "",
        stored.adults?.adult1 || "",
        stored.adults?.adult2 || "",
      ].filter(Boolean);
      const authorizedNames = allowedNames.map(normalizeAccessName);
      if (!authorizedNames.includes(enteredName)) {
        throw new Error("name-mismatch");
      }
      const representativeName = normalizeAccessName(
        stored.applicantName || allowedNames[0] || "",
      );
      const role =
        enteredName === representativeName ? "representative" : "additional";
      if (role === "additional" && !stored.adults?.adult2?.trim()) {
        throw new Error("family-setup-required");
      }
      await updateDoc(snapshot.ref, {
        lastVisitorUid: active.uid,
        updatedAt: serverTimestamp(),
      });
      setUser(active);
      setRespondentRole(role);
      setFamily({
        ...stored,
        _docId: snapshot.id,
      });
      sessionStorage.setItem("hamkkeFamilyNo", String(no));
      sessionStorage.setItem("hamkkeApplicantName", name);
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function persist(nextFamily: FamilyRecord, message = "저장됨") {
    if (!user) return;
    setSaved("저장 중…");
    if (!nextFamily._docId) throw new Error("not-found");
    const documentId = nextFamily._docId;
    const ref = doc(db, FAMILY_COLLECTION, documentId);
    await setDoc(
      ref,
      {
        familyName: nextFamily.familyName,
        applicantName: nextFamily.applicantName || "",
        familyType: nextFamily.familyType,
        adults: nextFamily.adults,
        children: nextFamily.children,
        changeWish: nextFamily.changeWish || "",
        pre: nextFamily.pre,
        post: nextFamily.post,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    setSaved(message);
  }

  async function saveRepresentativeIndex() {
    if (!family || !phase) return;
    const next = updateFamily((draft) => {
      draft[phase].indexRespondents ||= { adult1: "", adult2: "" };
      draft[phase].indexRespondents.adult1 =
        draft.applicantName || applicantName.trim();
    });
    if (!next) return;
    setBusy(true);
    try {
      await persist(next);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveAdditionalIndex() {
    if (!family || !phase || !user || !family._docId) return;
    const responseName = applicantName.trim();
    const next = updateFamily((draft) => {
      draft[phase].indexRespondents ||= { adult1: "", adult2: "" };
      draft[phase].indexRespondents.adult2 = responseName;
    });
    if (!next) return;
    setBusy(true);
    setSaved("저장 중…");
    try {
      await updateDoc(doc(db, FAMILY_COLLECTION, family._docId), {
        [`${phase}.indexAnswers.adult2`]:
          next[phase].indexAnswers.adult2,
        [`${phase}.indexRespondents.adult2`]: responseName,
        updatedAt: serverTimestamp(),
      });
      setSaved("저장됨");
      setStep(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  function updateFamily(mutator: (draft: FamilyRecord) => void) {
    if (!family) return null;
    const draft = cloneFamily(family);
    mutator(draft);
    setFamily(draft);
    setSaved("저장 필요");
    return draft;
  }

  function updateFamilyPhoto(photo?: FamilyPhoto) {
    setFamily((current) => {
      if (!current) return current;
      const next = { ...current };
      if (photo) next.familyPhoto = photo;
      else delete next.familyPhoto;
      return next;
    });
  }

  async function saveAndGo(nextStep: number) {
    if (!family) return;
    setBusy(true);
    setNotice("");
    try {
      await persist(family);
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  if (!family) {
    return (
      <main className="site-shell login-shell">
        <section className="hero-card login-card">
          <img
            className="brand-symbol"
            src="/assets/seo-gu-symbol.png"
            alt="서구 상징"
          />
          <div className="eyebrow">생활 속 양성평등 「함께 잇다」</div>
          <h1>함께가정</h1>
          <p className="hero-copy">
            함께 나누고, 함께 쉬는
            <br />
            우리 가족의 30일
          </p>
          <img
            className="login-haeoni"
            src="/assets/haeoni-yellow.png"
            alt="함께가정 해온이"
          />
          <div className="login-form">
            <label>
              가정 번호
              <input
                inputMode="numeric"
                value={familyNo}
                onChange={(e) =>
                  setFamilyNo(e.target.value.replace(/\D/g, "").slice(0, 2))
                }
                placeholder="예: 01"
              />
            </label>
            <label>
              엄마 또는 아빠 이름
              <input
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value.slice(0, 30))}
                placeholder="명단에 적은 이름"
                autoComplete="name"
              />
            </label>
            {notice && (
              <p className="error-message" role="alert">
                {notice}
              </p>
            )}
            <button className="primary-button" onClick={enter} disabled={busy}>
              {busy ? "확인 중…" : "시작하기"}
            </button>
          </div>
          <p className="privacy-note">
            가정 번호와 엄마·아빠 중 한 명의 이름으로 시작합니다.
          </p>
        </section>
      </main>
    );
  }

  if (!phase) {
    const additional = respondentRole === "additional";
    return (
      <main className="site-shell">
        <Header family={family} saved={saved} />
        {!additional && (
          <FamilyPhotoCard family={family} onChange={updateFamilyPhoto} />
        )}
        <section className="content-card phase-select">
          <span className="section-kicker">
            {additional ? "선택 참여" : "진단 선택"}
          </span>
          <h2>
            {additional
              ? `${applicantName.trim()}님의 함께지수`
              : "어떤 진단을 진행할까요?"}
          </h2>
          <p>
            {additional
              ? "다른 성인의 참여는 선택사항이며, 함께지수 10문항만 작성합니다."
              : "작성 중에도 자동 저장되어 다시 이어서 할 수 있어요."}
          </p>
          <div className="phase-grid">
            {phases.map((item) => (
              <button
                key={item.key}
                className="phase-card"
                onClick={() => {
                  if (additional) {
                    if (
                      item.key === "post" &&
                      !hasAdditionalResponse(family, "pre")
                    ) {
                      setNotice("사전 함께지수부터 작성해주세요.");
                      return;
                    }
                    setPhase(item.key);
                    setStep(
                      hasAdditionalResponse(family, item.key) ? 5 : 2,
                    );
                    setNotice("");
                    return;
                  }
                  if (
                    item.key === "post" &&
                    (!hasCompleteIndex(family.pre.indexAnswers.adult1) ||
                      family.pre.status !== "submitted")
                  ) {
                    setNotice("사전 진단을 먼저 제출해주세요.");
                    return;
                  }
                  const hasFamilyInfo = Boolean(family.adults.adult1.trim());
                  setPhase(item.key);
                  setStep(item.key === "post" && hasFamilyInfo ? 1 : 0);
                  setCardIndex(0);
                  setNotice("");
                }}
              >
                <img src={item.image} alt="" />
                <span>{item.period}</span>
                <strong>{item.title}</strong>
                <em>
                  {additional
                    ? hasAdditionalResponse(family, item.key)
                      ? "응답 완료 · 다시 보기"
                      : "10문항 참여하기"
                    : family[item.key].status === "submitted"
                      ? "제출 완료 · 다시 보기"
                      : "시작하기"}
                </em>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  }

  const current = family[phase];
  const finalStep = 5;

  if (respondentRole === "additional") {
    return (
      <main className="site-shell app-shell">
        <Header
          family={family}
          saved={saved}
          onHome={() => setPhase(null)}
        />
        {notice && (
          <p className="floating-notice" role="alert">
            {notice}
          </p>
        )}
        {step === 2 && (
          <IndexSurvey
            family={family}
            phase={phase}
            who="adult2"
            data={current}
            updateFamily={updateFamily}
            onBack={() => setPhase(null)}
            onNext={saveAdditionalIndex}
            busy={busy}
            setNotice={setNotice}
            additional
            displayName={applicantName.trim()}
          />
        )}
        {step === finalStep && (
          <AdditionalResult
            phase={phase}
            respondentName={applicantName.trim()}
            onHome={() => setPhase(null)}
            onEdit={() => setStep(2)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="site-shell app-shell">
      <Header family={family} saved={saved} onHome={() => setPhase(null)} />
      <Progress step={step} phase={phase} />
      {notice && (
        <p className="floating-notice" role="alert">
          {notice}
        </p>
      )}
      {step === 0 && (
        <FamilyInfo
          family={family}
          updateFamily={updateFamily}
          onNext={() => {
            if (!family.adults.adult1.trim()) {
              setNotice("성인 1의 실명을 입력해주세요.");
              return;
            }
            saveAndGo(1);
          }}
          busy={busy}
        />
      )}
      {step === 1 && (
        <CardSurvey
          family={family}
          phase={phase}
          data={current}
          cardIndex={cardIndex}
          setCardIndex={setCardIndex}
          updateFamily={updateFamily}
          persist={persist}
          onBack={() => setStep(0)}
          onDone={() => saveAndGo(2)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {step === 2 && (
        <IndexSurvey
          family={family}
          phase={phase}
          who="adult1"
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(1)}
          onNext={saveRepresentativeIndex}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {step === 3 && (
        <TimeSurvey
          family={family}
          phase={phase}
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(2)}
          onNext={() => saveAndGo(4)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {phase === "pre" && step === 4 && (
        <PromiseSurvey
          family={family}
          updateFamily={updateFamily}
          onBack={() => setStep(3)}
          onNext={() => saveAndGo(5)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {phase === "post" && step === 4 && (
        <Satisfaction
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(3)}
          onNext={() => saveAndGo(5)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {step === finalStep && (
        <Result
          family={family}
          phase={phase}
          data={current}
          updateFamily={updateFamily}
          persist={persist}
          onBack={() => setStep(finalStep - 1)}
          onHome={() => setPhase(null)}
          busy={busy}
          setBusy={setBusy}
          setNotice={setNotice}
        />
      )}
    </main>
  );
}
