"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, FAMILY_COLLECTION } from "../firebase";
import {
  cards,
  familyDocumentId,
  FamilyRecord,
  indexQuestions,
  childlessQuestion,
  indexScore,
  indexType,
  IndexChoice,
  ownerOptions,
  OwnerChoice,
  PhaseData,
  PhaseKey,
  satisfactionQuestions,
} from "../data";

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

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("permission-denied") || message.includes("not-found"))
    return "가정 번호 또는 접속번호가 맞지 않습니다.";
  if (message.includes("operation-not-allowed"))
    return "익명 로그인이 아직 설정되지 않았습니다. 관리자에게 알려주세요.";
  if (message.includes("network"))
    return "인터넷 연결을 확인한 뒤 다시 시도해주세요.";
  return "잠시 후 다시 시도해주세요.";
}

function cloneFamily(value: FamilyRecord): FamilyRecord {
  return JSON.parse(JSON.stringify(value));
}

export default function FamilyApp() {
  const [familyNo, setFamilyNo] = useState("");
  const [pin, setPin] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [phase, setPhase] = useState<PhaseKey | null>(null);
  const [step, setStep] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("저장됨");

  useEffect(() => {
    const storedNo = sessionStorage.getItem("hamkkeFamilyNo");
    if (storedNo) setFamilyNo(storedNo);
  }, []);

  async function enter() {
    const no = Number(familyNo);
    if (!Number.isInteger(no) || no < 1 || !/^\d{6}$/.test(pin)) {
      setNotice("가정 번호와 6자리 접속번호를 확인해주세요.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      let active = auth.currentUser;
      if (!active) {
        try {
          active = (await signInAnonymously(auth)).user;
        } catch (authError) {
          const authMessage =
            authError instanceof Error ? authError.message : String(authError);
          if (!authMessage.includes("operation-not-allowed")) throw authError;
          active = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
        }
      }
      const documentId = await familyDocumentId(no, pin);
      const ref = doc(db, FAMILY_COLLECTION, documentId);
      let snapshot;
      try {
        snapshot = await getDoc(ref);
      } catch {
        await updateDoc(ref, {
          ownerUid: active.uid,
          accessPin: pin,
          claimedAt: serverTimestamp(),
        });
        snapshot = await getDoc(ref);
      }
      if (!snapshot.exists()) throw new Error("permission-denied");
      const data = snapshot.data() as FamilyRecord;
      if (data.ownerUid !== active.uid) {
        await updateDoc(ref, {
          ownerUid: active.uid,
          accessPin: pin,
          claimedAt: serverTimestamp(),
        });
        snapshot = await getDoc(ref);
      }
      setUser(active);
      setFamily({ ...(snapshot.data() as FamilyRecord), _docId: snapshot.id });
      sessionStorage.setItem("hamkkeFamilyNo", String(no));
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function persist(nextFamily: FamilyRecord, message = "저장됨") {
    if (!user) return;
    setSaved("저장 중…");
    const documentId =
      nextFamily._docId ||
      (await familyDocumentId(nextFamily.familyNo, nextFamily.accessPin));
    const ref = doc(db, FAMILY_COLLECTION, documentId);
    await setDoc(
      ref,
      {
        familyName: nextFamily.familyName,
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

  function updateFamily(mutator: (draft: FamilyRecord) => void) {
    if (!family) return null;
    const draft = cloneFamily(family);
    mutator(draft);
    setFamily(draft);
    setSaved("저장 필요");
    return draft;
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
              접속번호
              <input
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6자리"
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
            가정별 접속번호로 응답을 안전하게 구분합니다.
          </p>
        </section>
      </main>
    );
  }

  if (!phase) {
    return (
      <main className="site-shell">
        <Header family={family} saved={saved} />
        <section className="content-card phase-select">
          <span className="section-kicker">진단 선택</span>
          <h2>어떤 진단을 진행할까요?</h2>
          <p>작성 중에도 자동 저장되어 다시 이어서 할 수 있어요.</p>
          <div className="phase-grid">
            {phases.map((item) => (
              <button
                key={item.key}
                className="phase-card"
                onClick={() => {
                  setPhase(item.key);
                  setStep(0);
                }}
              >
                <img src={item.image} alt="" />
                <span>{item.period}</span>
                <strong>{item.title}</strong>
                <em>
                  {family[item.key].status === "submitted"
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
  const finalStep = 6;
  return (
    <main className="site-shell app-shell">
      <Header family={family} saved={saved} onHome={() => setPhase(null)} />
      <Progress step={step} finalStep={finalStep} phase={phase} />
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
            if (
              !family.familyName.trim() ||
              !family.adults.adult1.trim() ||
              !family.adults.adult2.trim()
            ) {
              setNotice(
                "가정 이름과 성인 두 분의 이름(또는 별명)을 적어주세요.",
              );
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
          onNext={() => saveAndGo(3)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {step === 3 && (
        <IndexSurvey
          family={family}
          phase={phase}
          who="adult2"
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(2)}
          onNext={() => saveAndGo(4)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {step === 4 && (
        <TimeSurvey
          family={family}
          phase={phase}
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(3)}
          onNext={() => saveAndGo(5)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {phase === "pre" && step === 5 && (
        <PromiseSurvey
          family={family}
          updateFamily={updateFamily}
          onBack={() => setStep(4)}
          onNext={() => saveAndGo(6)}
          busy={busy}
          setNotice={setNotice}
        />
      )}
      {phase === "post" && step === 5 && (
        <Satisfaction
          family={family}
          data={current}
          updateFamily={updateFamily}
          onBack={() => setStep(4)}
          onNext={() => saveAndGo(6)}
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

function Header({
  family,
  saved,
  onHome,
}: {
  family: FamilyRecord;
  saved: string;
  onHome?: () => void;
}) {
  return (
    <header className="app-header">
      <button className="logo-button" onClick={onHome} disabled={!onHome}>
        <img src="/assets/seo-gu-symbol.png" alt="" />
        <span>
          <b>함께가정</b>
          <small>{family.familyName || `${family.familyNo}번 가정`}</small>
        </span>
      </button>
      <span className={saved === "저장됨" ? "save-state done" : "save-state"}>
        {saved}
      </span>
    </header>
  );
}

function Progress({
  step,
  finalStep,
  phase,
}: {
  step: number;
  finalStep: number;
  phase: PhaseKey;
}) {
  const labels =
    phase === "post"
      ? ["가족", "카드", "성인1", "성인2", "시간", "만족도", "완료"]
      : ["가족", "카드", "성인1", "성인2", "시간", "약속", "완료"];
  return (
    <nav className="progress-wrap" aria-label="진행 단계">
      <div className="progress-line">
        <i style={{ width: `${(step / finalStep) * 100}%` }} />
      </div>
      <div className="progress-labels">
        {labels.map((label, i) => (
          <span className={i <= step ? "active" : ""} key={label}>
            {label}
          </span>
        ))}
      </div>
    </nav>
  );
}

type UpdateFamily = (
  mutator: (draft: FamilyRecord) => void,
) => FamilyRecord | null;

function FamilyInfo({
  family,
  updateFamily,
  onNext,
  busy,
}: {
  family: FamilyRecord;
  updateFamily: UpdateFamily;
  onNext: () => void;
  busy: boolean;
}) {
  return (
    <section className="content-card">
      <span className="section-kicker">1. 가족 등록</span>
      <h2>우리 가족을 알려주세요</h2>
      <p className="lead">
        이름 대신 가족끼리 알아볼 수 있는 별명을 적어도 좋아요.
      </p>
      <div className="form-grid">
        <label className="full">
          가정 이름
          <input
            value={family.familyName}
            onChange={(e) =>
              updateFamily((d) => {
                d.familyName = e.target.value;
              })
            }
            placeholder="예: 행복한 해온이네"
          />
        </label>
        <label>
          성인 1
          <input
            value={family.adults.adult1}
            onChange={(e) =>
              updateFamily((d) => {
                d.adults.adult1 = e.target.value;
              })
            }
            placeholder="이름 또는 별명"
          />
        </label>
        <label>
          성인 2
          <input
            value={family.adults.adult2}
            onChange={(e) =>
              updateFamily((d) => {
                d.adults.adult2 = e.target.value;
              })
            }
            placeholder="이름 또는 별명"
          />
        </label>
        <fieldset className="full">
          <legend>가정 유형</legend>
          <div className="segmented">
            <button
              className={family.familyType === "children" ? "selected" : ""}
              onClick={() =>
                updateFamily((d) => {
                  d.familyType = "children";
                })
              }
            >
              자녀가 있어요
            </button>
            <button
              className={family.familyType === "childless" ? "selected" : ""}
              onClick={() =>
                updateFamily((d) => {
                  d.familyType = "childless";
                  d.children = [];
                })
              }
            >
              자녀가 없어요
            </button>
          </div>
        </fieldset>
        {family.familyType === "children" && (
          <label className="full">
            자녀 이름·별명 (선택)
            <input
              value={family.children.join(", ")}
              onChange={(e) =>
                updateFamily((d) => {
                  d.children = e.target.value
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean);
                })
              }
              placeholder="여러 명이면 쉼표로 구분"
            />
          </label>
        )}
      </div>
      <BottomActions primary="함께카드 시작" onPrimary={onNext} busy={busy} />
    </section>
  );
}

function CardSurvey({
  family,
  phase,
  data,
  cardIndex,
  setCardIndex,
  updateFamily,
  persist,
  onBack,
  onDone,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  data: PhaseData;
  cardIndex: number;
  setCardIndex: (n: number) => void;
  updateFamily: UpdateFamily;
  persist: (f: FamilyRecord) => Promise<void>;
  onBack: () => void;
  onDone: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const card = cards[cardIndex];
  const selected = data.cards[card.id];
  const optionLabel = (value: OwnerChoice) =>
    value === "adult1"
      ? family.adults.adult1
      : value === "adult2"
        ? family.adults.adult2
        : ownerOptions.find((o) => o.value === value)?.label || "";
  async function choose(value: OwnerChoice) {
    const next = updateFamily((d) => {
      d[phase].cards[card.id] = value;
    });
    if (next) {
      try {
        await persist(next);
      } catch {
        setNotice("저장하지 못했습니다. 인터넷 연결을 확인해주세요.");
      }
    }
  }
  function move(delta: number) {
    if (!selected && delta > 0) {
      setNotice("담당 가족을 먼저 선택해주세요.");
      return;
    }
    setNotice("");
    setCardIndex(cardIndex + delta);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const answered = Object.keys(data.cards).length;
  return (
    <section className="content-card card-survey">
      <div className="card-topline">
        <span className="section-kicker">2. 함께카드</span>
        <b>{answered}/100 응답</b>
      </div>
      <div className="card-meter">
        <i style={{ width: `${answered}%` }} />
      </div>
      <div className="survey-card">
        <span className="category-pill">{card.category}</span>
        <small>카드 {card.id} / 100</small>
        <h2>
          {Number(card.id) > 98
            ? data.customTitles[card.id] || card.title
            : card.title}
        </h2>
        {Number(card.id) > 98 && (
          <input
            className="custom-role"
            value={data.customTitles[card.id] || ""}
            onChange={(e) =>
              updateFamily((d) => {
                d[phase].customTitles[card.id] = e.target.value;
              })
            }
            placeholder="우리 집만의 역할을 적어주세요"
          />
        )}
        <p>이 역할을 주로 담당하는 가족은 누구인가요?</p>
      </div>
      <div className="owner-grid">
        {ownerOptions.map((option) => (
          <button
            key={option.value}
            disabled={
              option.value === "child" && family.familyType === "childless"
            }
            className={
              selected === option.value
                ? "owner-option selected"
                : "owner-option"
            }
            onClick={() => choose(option.value)}
          >
            <span>{option.icon}</span>
            <b>{optionLabel(option.value)}</b>
          </button>
        ))}
      </div>
      <p className="tap-guide">
        선택 즉시 저장돼요. 별도의 확인 버튼은 없습니다.
      </p>
      <div className="sticky-card-actions">
        <button
          className="secondary-button"
          onClick={() => (cardIndex === 0 ? onBack() : move(-1))}
        >
          이전
        </button>
        {cardIndex < cards.length - 1 ? (
          <button className="primary-button" onClick={() => move(1)}>
            다음 카드
          </button>
        ) : (
          <button
            className="primary-button"
            onClick={() => {
              if (answered < 100) {
                setNotice(`아직 ${100 - answered}장이 남았어요.`);
                return;
              }
              onDone();
            }}
            disabled={busy}
          >
            함께지수로
          </button>
        )}
      </div>
    </section>
  );
}

function IndexSurvey({
  family,
  phase,
  who,
  data,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  who: "adult1" | "adult2";
  data: PhaseData;
  updateFamily: UpdateFamily;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const name = family.adults[who] || (who === "adult1" ? "성인 1" : "성인 2");
  const answers = data.indexAnswers[who];
  const complete = answers.every(Boolean);
  return (
    <section className="content-card">
      <span className="section-kicker">3. 우리집 함께지수</span>
      <h2>{name}님의 생각</h2>
      <p className="lead">서로 상의하지 말고 각자의 생각대로 답해주세요.</p>
      <div className="question-list">
        {indexQuestions.map((question, i) => (
          <article className="question" key={question}>
            <p>
              <b>{i + 1}</b>
              {i === 2 && family.familyType === "childless"
                ? childlessQuestion
                : question}
            </p>
            <div className="answer-three">
              {(["O", "△", "X"] as IndexChoice[]).map((choice) => (
                <button
                  key={choice}
                  className={answers[i] === choice ? "selected" : ""}
                  onClick={() =>
                    updateFamily((d) => {
                      d[phase].indexAnswers[who][i] = choice;
                    })
                  }
                >
                  <b>{choice}</b>
                  <small>
                    {choice === "O"
                      ? "그렇다"
                      : choice === "△"
                        ? "보통"
                        : "아니다"}
                  </small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <BottomActions
        primary={who === "adult1" ? "성인 2 응답으로" : "시간 기록으로"}
        onPrimary={() => {
          if (!complete) {
            setNotice("10문항을 모두 답해주세요.");
            return;
          }
          onNext();
        }}
        secondary="이전"
        onSecondary={onBack}
        busy={busy}
      />
    </section>
  );
}

function TimeSurvey({
  family,
  phase,
  data,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  data: PhaseData;
  updateFamily: UpdateFamily;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const rows = [
    ["housework", "집안일·돌봄", "실제로 몸을 써서 한 시간"],
    ["mental", "가족 챙김", "일정·준비물·연락 등을 생각하고 챙긴 시간"],
    ["rest", "혼자 쉰 시간", "온전히 나를 위해 쉰 시간"],
  ] as const;
  const complete = (["adult1", "adult2"] as const).every((who) =>
    rows.every(([key]) => data.times[who][key] !== ""),
  );
  return (
    <section className="content-card">
      <span className="section-kicker">4. 일주일 시간 기록</span>
      <h2>지난 일주일을 떠올려주세요</h2>
      <p className="lead">
        정확하지 않아도 괜찮아요. 대략적인 시간을 숫자로 적어주세요.
      </p>
      <div className="time-table">
        <div />
        <b>{family.adults.adult1 || "성인 1"}</b>
        <b>{family.adults.adult2 || "성인 2"}</b>
        {rows.map(([key, title, help]) => (
          <div className="time-row" key={key}>
            <div>
              <strong>{title}</strong>
              <small>{help}</small>
            </div>
            {(["adult1", "adult2"] as const).map((who) => (
              <label key={who}>
                <input
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  value={data.times[who][key]}
                  onChange={(e) =>
                    updateFamily((d) => {
                      d[phase].times[who][key] = e.target.value;
                    })
                  }
                />
                <span>시간</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <BottomActions
        primary={phase === "post" ? "만족도 조사로" : "결과 확인"}
        onPrimary={() => {
          if (!complete) {
            setNotice("두 분의 시간을 모두 적어주세요.");
            return;
          }
          onNext();
        }}
        secondary="이전"
        onSecondary={onBack}
        busy={busy}
      />
    </section>
  );
}

function Satisfaction({
  family,
  data,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  data: PhaseData;
  updateFamily: UpdateFamily;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  const complete = data.satisfaction.ratings.every(Boolean);
  return (
    <section className="content-card">
      <span className="section-kicker">5. 활동 만족도</span>
      <h2>30일 활동은 어떠셨나요?</h2>
      <p className="lead">
        1점(전혀 그렇지 않다)부터 5점(매우 그렇다)까지 골라주세요.
      </p>
      <div className="question-list satisfaction-list">
        {satisfactionQuestions.map((q, i) => (
          <article className="question" key={q}>
            <p>
              <b>{i + 1}</b>
              {q}
            </p>
            <div className="rating-five">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  className={
                    data.satisfaction.ratings[i] === n ? "selected" : ""
                  }
                  key={n}
                  onClick={() =>
                    updateFamily((d) => {
                      d.post.satisfaction.ratings[i] = n;
                    })
                  }
                >
                  {n}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <label className="feedback-label">
        함께가정에 전하고 싶은 이야기 (선택)
        <textarea
          value={data.satisfaction.feedback}
          onChange={(e) =>
            updateFamily((d) => {
              d.post.satisfaction.feedback = e.target.value;
            })
          }
          placeholder="좋았던 점이나 바라는 점을 자유롭게 적어주세요."
        />
      </label>
      <BottomActions
        primary="결과 확인"
        onPrimary={() => {
          if (!complete) {
            setNotice("만족도 5문항을 모두 답해주세요.");
            return;
          }
          onNext();
        }}
        secondary="이전"
        onSecondary={onBack}
        busy={busy}
      />
    </section>
  );
}

function PromiseSurvey({
  family,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
  family: FamilyRecord;
  updateFamily: UpdateFamily;
  onBack: () => void;
  onNext: () => void;
  busy: boolean;
  setNotice: (s: string) => void;
}) {
  return (
    <section className="content-card promise-card">
      <span className="section-kicker">5. 우리 가족의 약속</span>
      <h2>30일 동안 함께 바꿔볼 점</h2>
      <img src="/assets/haeoni-red-wave.png" alt="응원하는 해온이" />
      <label className="feedback-label">
        우리 가족이 이번 30일 동안 바꿔보고 싶은 점이 있다면 자유롭게
        적어주세요.
        <textarea
          value={family.changeWish || ""}
          onChange={(e) =>
            updateFamily((d) => {
              d.changeWish = e.target.value;
            })
          }
          placeholder="우리 가족의 이야기를 적어주세요."
        />
      </label>
      <BottomActions
        primary="결과 확인"
        onPrimary={() => {
          if (!(family.changeWish || "").trim()) {
            setNotice("우리 가족이 바꿔보고 싶은 점을 적어주세요.");
            return;
          }
          onNext();
        }}
        secondary="이전"
        onSecondary={onBack}
        busy={busy}
      />
    </section>
  );
}

function Result({
  family,
  phase,
  data,
  updateFamily,
  persist,
  onBack,
  onHome,
  busy,
  setBusy,
  setNotice,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  data: PhaseData;
  updateFamily: UpdateFamily;
  persist: (f: FamilyRecord, m?: string) => Promise<void>;
  onBack: () => void;
  onHome: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setNotice: (s: string) => void;
}) {
  const score1 = indexScore(data.indexAnswers.adult1),
    score2 = indexScore(data.indexAnswers.adult2);
  const gap = Math.abs(score1 - score2);
  const counts = useMemo(
    () =>
      ownerOptions.map((o) => ({
        ...o,
        count: Object.values(data.cards).filter((v) => v === o.value).length,
      })),
    [data.cards],
  );
  async function submit() {
    setBusy(true);
    try {
      const next = updateFamily((d) => {
        d[phase].status = "submitted";
      });
      if (next) await persist(next, "제출됨");
    } catch (error) {
      setNotice(formatError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-card result-card">
      <div className="result-hero">
        <img src="/assets/haeoni-suit-arms.png" alt="기뻐하는 해온이" />
        <div>
          <span className="section-kicker">
            {phase === "pre" ? "사전" : "사후"} 진단 결과
          </span>
          <h2>
            {family.familyName},<br />
            함께여서 더 따뜻해요!
          </h2>
        </div>
      </div>
      <div className="score-grid">
        <article>
          <span>{family.adults.adult1}</span>
          <strong>
            {score1}
            <small>점</small>
          </strong>
          <b>{indexType(score1)}</b>
        </article>
        <article>
          <span>{family.adults.adult2}</span>
          <strong>
            {score2}
            <small>점</small>
          </strong>
          <b>{indexType(score2)}</b>
        </article>
      </div>
      {gap >= 15 && (
        <p className="gap-note">
          두 분의 생각에 {gap}점 차이가 있어요. 틀린 답은 없습니다. 서로 다르게
          느낀 문항부터 편안하게 이야기해보세요.
        </p>
      )}
      <section className="summary-box">
        <h3>함께카드 담당 현황</h3>
        <div className="count-grid">
          {counts.map((c) => (
            <div key={c.value}>
              <span>{c.label}</span>
              <b>{c.count}장</b>
            </div>
          ))}
        </div>
      </section>
      <section className="summary-box">
        <h3>일주일 시간 비교</h3>
        <div className="time-summary">
          <span />
          <b>{family.adults.adult1}</b>
          <b>{family.adults.adult2}</b>
          <span>집안일·돌봄</span>
          <b>{data.times.adult1.housework}시간</b>
          <b>{data.times.adult2.housework}시간</b>
          <span>가족 챙김</span>
          <b>{data.times.adult1.mental}시간</b>
          <b>{data.times.adult2.mental}시간</b>
          <span>혼자 쉼</span>
          <b>{data.times.adult1.rest}시간</b>
          <b>{data.times.adult2.rest}시간</b>
        </div>
      </section>
      {data.status === "submitted" ? (
        <div className="submitted-box">
          <b>제출이 완료되었습니다</b>
          <p>응답은 관리자에게 안전하게 전달됐어요.</p>
          <button className="secondary-button" onClick={onHome}>
            처음 화면으로
          </button>
        </div>
      ) : (
        <BottomActions
          primary="관리자에게 제출"
          onPrimary={submit}
          secondary="이전"
          onSecondary={onBack}
          busy={busy}
        />
      )}
      <button className="print-button" onClick={() => window.print()}>
        결과 화면 출력하기
      </button>
    </section>
  );
}

function BottomActions({
  primary,
  onPrimary,
  secondary,
  onSecondary,
  busy,
}: {
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="bottom-actions">
      {secondary && (
        <button className="secondary-button" onClick={onSecondary}>
          {secondary}
        </button>
      )}
      <button className="primary-button" onClick={onPrimary} disabled={busy}>
        {busy ? "저장 중…" : primary}
      </button>
    </div>
  );
}
