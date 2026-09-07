import {
  childlessQuestion,
  FamilyRecord,
  hasSecondAdult,
  IndexChoice,
  indexQuestions,
  PhaseData,
  PhaseKey,
  satisfactionQuestions,
} from "../../data";
import { UpdateFamily } from "./helpers";
import { BottomActions } from "./Shared";

export function IndexSurvey({
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
        primary={
          who === "adult1" && hasSecondAdult(family)
            ? `${family.adults.adult2}님 응답으로`
            : "시간 기록으로"
        }
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

export function TimeSurvey({
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
  const people = hasSecondAdult(family)
    ? (["adult1", "adult2"] as const)
    : (["adult1"] as const);
  const complete = people.every((who) =>
    rows.every(([key]) => data.times[who][key] !== ""),
  );
  return (
    <section className="content-card">
      <span className="section-kicker">4. 일주일 시간 기록</span>
      <h2>지난 일주일을 떠올려주세요</h2>
      <p className="lead">
        정확하지 않아도 괜찮아요. 대략적인 시간을 숫자로 적어주세요.
      </p>
      <div
        className={
          people.length === 1 ? "time-table single" : "time-table"
        }
      >
        <div />
        <b>{family.adults.adult1 || "성인 1"}</b>
        {people.length === 2 && <b>{family.adults.adult2}</b>}
        {rows.map(([key, title, help]) => (
          <div className="time-row" key={key}>
            <div>
              <strong>{title}</strong>
              <small>{help}</small>
            </div>
            {people.map((who) => (
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
            setNotice(
              people.length === 1
                ? "시간을 모두 적어주세요."
                : "두 분의 시간을 모두 적어주세요.",
            );
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

export function Satisfaction({
  data,
  updateFamily,
  onBack,
  onNext,
  busy,
  setNotice,
}: {
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
