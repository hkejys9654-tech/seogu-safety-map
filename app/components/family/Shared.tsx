import { FamilyRecord, PhaseKey } from "../../data";

export function Header({
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

export function Progress({
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

export function BottomActions({
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
