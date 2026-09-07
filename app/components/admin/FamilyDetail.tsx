import { useMemo, useState } from "react";
import {
  cards,
  childlessQuestion,
  FamilyRecord,
  indexQuestions,
  indexScore,
  indexType,
  PhaseKey,
  satisfactionQuestions,
} from "../../data";
import { ownerLabel, Status } from "./helpers";
import { FamilyEditForm, FamilyEdits } from "./FamilyEditForm";

export function FamilyDetail({
  family,
  phase,
  setPhase,
  onClose,
  onCompletion,
  onSave,
  onDelete,
}: {
  family: FamilyRecord;
  phase: PhaseKey;
  setPhase: (p: PhaseKey) => void;
  onClose: () => void;
  onCompletion: (f: FamilyRecord, v: number) => void;
  onSave: (f: FamilyRecord, edits: FamilyEdits) => Promise<void>;
  onDelete: (f: FamilyRecord) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
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
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="detail-panel">
        <header>
          <div>
            <span>{String(family.familyNo).padStart(2, "0")}번 가정</span>
            <h2>
              {family.applicantName
                ? `${family.applicantName} 신청자`
                : "미등록 가정"}
            </h2>
            <p>
              {family.adults.adult1 || "성인 1 미등록"} ·{" "}
              {family.adults.adult2 || "성인 2 미등록"} · 신청자{" "}
              <b>{family.applicantName || "미입력"}</b>
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
          <div className="detail-tool-buttons">
            <button onClick={() => setEditing((value) => !value)}>
              {editing ? "수정 닫기" : "정보 수정"}
            </button>
            <button className="danger-button" onClick={() => onDelete(family)}>
              제출자 삭제
            </button>
          </div>
        </div>
        {editing && (
          <FamilyEditForm
            family={family}
            onSave={(edits) => onSave(family, edits)}
            onCancel={() => setEditing(false)}
          />
        )}
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
