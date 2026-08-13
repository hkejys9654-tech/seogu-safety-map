"use client";

import { useEffect, useRef, useState } from "react";
import type { ChoreCard, FamilyRecord, Member } from "../data";
import { createBlankFamily, DEFAULT_CARDS, WEEK_INFO } from "../data";

const IMAGES = {
  yellow: "/assets/haeoni-yellow.png",
  wave: "/assets/haeoni-red-wave.png",
  apron: "/assets/haeoni-apron.png",
  calling: "/assets/haeoni-calling.png",
  cheer: "/assets/haeoni-red-cheer.png",
  suit: "/assets/haeoni-suit-cheer.png",
};

type TabKey = "home" | "place" | "week" | "report";
type SaveState = "idle" | "saving" | "saved" | "error";

function normalizeFamily(value: FamilyRecord): FamilyRecord {
  return {
    ...createBlankFamily(value.no),
    ...value,
    members: Array.isArray(value.members) ? value.members : [],
    weeks: WEEK_INFO.map((_, index) => value.weeks?.[index] || createBlankFamily(value.no).weeks[index]),
  };
}

function activeMembers(family: FamilyRecord) {
  return family.members.filter((member) => member.nickname.trim());
}

export function getCompletion(family: FamilyRecord) {
  let done = 0;
  let total = 0;
  for (const week of family.weeks) {
    for (const checks of Object.values(week.checks || {})) {
      total += 7;
      done += (checks || []).filter(Boolean).length;
    }
  }
  return { done, total, rate: total ? Math.round((done / total) * 100) : 0 };
}

function OwnerName({ owner, members }: { owner?: string; members: Member[] }) {
  const label = owner === "together" ? "함께" : owner === "none" ? "아무도 안 함" : members.find((m) => m.id === owner)?.nickname;
  return <>{label || "미정"}</>;
}

export default function FamilyApp() {
  const [cards, setCards] = useState<ChoreCard[]>(DEFAULT_CARDS);
  const [familyNo, setFamilyNo] = useState("");
  const [family, setFamily] = useState<FamilyRecord | null>(null);
  const [tab, setTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/cards").then((response) => response.json()).then((data) => {
      if (Array.isArray(data.cards)) setCards(data.cards);
    }).catch(() => setCards(DEFAULT_CARDS));
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function enter() {
    const digits = familyNo.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    const no = digits.padStart(2, "0");
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/families/${no}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "기록을 열지 못했습니다.");
      setFamily(normalizeFamily(data.family || createBlankFamily(no)));
      setFamilyNo(no);
      setTab("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function persist(next: FamilyRecord) {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/families/${next.no}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ family: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      setFamily(normalizeFamily(data.family));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState("error");
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  }

  function updateFamily(next: FamilyRecord, immediate = false) {
    setFamily(next);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void persist(next);
    else timer.current = setTimeout(() => void persist(next), 650);
  }

  if (!family) {
    return (
      <main className="landing-shell">
        <header className="brand-header">
          <div className="brand-lockup">
            <img src="/assets/seo-gu-symbol.png" alt="전남광주통합특별시 심볼" />
            <div><strong>전남광주통합특별시</strong><span>양성평등 가족실천 워크북</span></div>
          </div>
          <div className="landing-actions"><button className="print-button" type="button" onClick={() => window.print()}>인쇄·PDF</button><a className="admin-shortcut" href="/admin">관리자</a></div>
        </header>
        <section className="landing-card">
          <div className="landing-copy">
            <p className="eyebrow">30일, 우리집을 바꾸는 작은 약속</p>
            <h1>집안일도 마음도<br /><em>같이</em></h1>
            <p className="lead">보이는 일부터 보이지 않는 마음까지, 우리 가족의 일을 함께 발견하고 나누는 모바일 워크북입니다.</p>
            <div className="login-card">
              <label htmlFor="family-number">가정번호</label>
              <div className="login-row">
                <input id="family-number" value={familyNo} onChange={(event) => setFamilyNo(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => event.key === "Enter" && void enter()} inputMode="numeric" autoComplete="off" placeholder="예: 07" aria-describedby="privacy-note" />
                <button onClick={() => void enter()} disabled={!familyNo || loading}>{loading ? "여는 중" : "시작하기"}</button>
              </div>
              {message && <p className="error-text" role="alert">{message}</p>}
              <p id="privacy-note" className="privacy-note">이름과 주소는 받지 않아요. 가족 호칭과 활동 기록은 운영 데이터베이스에 저장되어 관리자 참여 현황에 반영됩니다.</p>
            </div>
          </div>
          <div className="landing-visual" aria-hidden="true">
            <span className="soft-orb orb-one" /><span className="soft-orb orb-two" />
            <img src={IMAGES.yellow} alt="" /><div className="hello-bubble">안녕! 나는 해온이야</div>
          </div>
        </section>
        <section className="how-grid" aria-label="이용 순서">
          <article><span>01</span><strong>우리 가족 등록</strong><p>이름 대신 편한 호칭만 적어요.</p></article>
          <article><span>02</span><strong>집안일 카드 배치</strong><p>누가 알아채고 준비하고 실행하는지 살펴봐요.</p></article>
          <article><span>03</span><strong>4주 동안 실천</strong><p>작은 약속을 정하고 서로 응원해요.</p></article>
        </section>
        <img className="brand-slogan" src="/assets/brand-slogan.png" alt="착한도시 서구" />
      </main>
    );
  }

  const members = activeMembers(family);
  const stats = getCompletion(family);
  const nav: Array<{ key: TabKey; label: string; icon: string }> = [
    { key: "home", label: "우리집", icon: "⌂" }, { key: "place", label: "카드 배치", icon: "▦" },
    { key: "week", label: "이번 주", icon: "✓" }, { key: "report", label: "변화", icon: "↗" },
  ];

  return (
    <main className="app-canvas">
      <header className="app-header">
        <button className="mini-brand" onClick={() => setFamily(null)} aria-label="첫 화면으로 돌아가기"><img src="/assets/seo-gu-symbol.png" alt="" /><span><strong>같이 온(溫) 가정</strong><small>{family.no}번 우리집</small></span></button>
        <div className="app-header-actions"><button className="print-button" type="button" onClick={() => window.print()}>현재 화면 인쇄·PDF</button><div className={`save-pill ${saveState}`} aria-live="polite">{saveState === "saving" ? "저장 중…" : saveState === "error" ? "저장 확인" : "자동 저장됨"}</div></div>
      </header>
      <div className="app-layout">
        <aside className="desktop-nav">
          <div className="nav-character"><img src={IMAGES.wave} alt="손을 흔드는 해온이" /></div>
          {nav.map((item) => <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><span>{item.icon}</span>{item.label}</button>)}
          <a href="/admin">관리자 화면</a>
        </aside>
        <section className="workspace">
          {tab === "home" && <HomeTab family={family} cards={cards} update={updateFamily} go={setTab} />}
          {tab === "place" && <PlacementTab family={family} cards={cards} members={members} update={updateFamily} />}
          {tab === "week" && <WeekTab family={family} cards={cards} members={members} update={updateFamily} />}
          {tab === "report" && <ReportTab family={family} cards={cards} members={members} stats={stats} />}
          {message && <p className="error-banner" role="alert">{message}</p>}
        </section>
      </div>
      <nav className="mobile-nav" aria-label="주요 메뉴">{nav.map((item) => <button key={item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}><span>{item.icon}</span>{item.label}</button>)}</nav>
    </main>
  );
}

function SectionHead({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-head"><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></div>;
}

function HomeTab({ family, cards, update, go }: { family: FamilyRecord; cards: ChoreCard[]; update: (next: FamilyRecord) => void; go: (tab: TabKey) => void }) {
  const [editing, setEditing] = useState(!family.members.some((member) => member.nickname));
  const members = activeMembers(family);
  const placed = Object.keys(family.placementBefore || {}).length;
  const stats = getCompletion(family);
  const changeMember = (index: number, patch: Partial<Member>) => update({ ...family, members: family.members.map((member, i) => i === index ? { ...member, ...patch } : member) });
  return <div>
    <SectionHead eyebrow={`${family.no}번 우리집`} title="오늘도 같이" description="가족과 집안일을 함께 나눠보세요." />
    <div className="welcome-panel"><div><p>해온이의 한마디</p><strong>{members.length ? `${members.map((m) => m.nickname).join(" · ")} 가족, 반가워!` : "우리 가족을 먼저 알려줘!"}</strong></div><img src={IMAGES.apron} alt="엄지를 든 해온이" /></div>
    <div className="stat-grid">
      <button onClick={() => go("place")}><span>카드 배치</span><strong>{placed}<small> / {cards.length}</small></strong><em>이어하기 →</em></button>
      <button onClick={() => go("week")}><span>실천 스티커</span><strong>{stats.done}<small>개</small></strong><em>기록하기 →</em></button>
      <button onClick={() => go("report")}><span>우리집 실천율</span><strong>{stats.rate}<small>%</small></strong><em>변화 보기 →</em></button>
    </div>
    <div className="panel family-panel">
      <div className="panel-title"><div><p>우리 가족</p><span>실명 대신 서로 부르는 호칭을 적어 주세요.</span></div><button onClick={() => setEditing(!editing)}>{editing ? "완료" : "수정"}</button></div>
      <div className="member-list">{family.members.map((member, index) => editing ? <div className="member-edit" key={member.id}>
        <span className={`avatar ${member.kid ? "kid" : ""}`}>{member.nickname.trim().slice(0, 1) || index + 1}</span>
        <input value={member.nickname} onChange={(event) => changeMember(index, { nickname: event.target.value })} placeholder="예: 엄마, 아빠, 첫째" />
        <label><input type="checkbox" checked={member.kid} onChange={(event) => changeMember(index, { kid: event.target.checked })} />아이</label>
        {family.members.length > 1 && <button aria-label="가족 구성원 삭제" onClick={() => update({ ...family, members: family.members.filter((_, i) => i !== index) })}>×</button>}
      </div> : member.nickname.trim() ? <div className="member-view" key={member.id}><span className={`avatar ${member.kid ? "kid" : ""}`}>{member.nickname.trim().slice(0, 1)}</span><strong>{member.nickname}</strong><small>{member.kid ? "아이" : "가족"}</small></div> : null)}</div>
      {editing && <button className="add-row" onClick={() => update({ ...family, members: [...family.members, { id: `m${Date.now()}`, nickname: "", kid: false }] })}>+ 가족 구성원 추가</button>}
    </div>
  </div>;
}

function PlacementTab({ family, cards, members, update }: { family: FamilyRecord; cards: ChoreCard[]; members: Member[]; update: (next: FamilyRecord) => void }) {
  const [phase, setPhase] = useState<"before" | "after">("before");
  const map = phase === "before" ? family.placementBefore : family.placementAfter;
  const placed = Object.keys(map || {}).length;
  function assign(cardId: string, owner: string) {
    const nextMap = { ...map }; if (owner) nextMap[cardId] = owner; else delete nextMap[cardId];
    update(phase === "before" ? { ...family, placementBefore: nextMap } : { ...family, placementAfter: nextMap });
  }
  return <div>
    <SectionHead eyebrow="STEP 1" title="우리집 카드 배치" description="집안일을 주로 누가 맡는지 솔직하게 골라보세요." />
    <div className="phase-switch" role="tablist"><button role="tab" aria-selected={phase === "before"} className={phase === "before" ? "active" : ""} onClick={() => setPhase("before")}>시작 전</button><button role="tab" aria-selected={phase === "after"} className={phase === "after" ? "active" : ""} onClick={() => setPhase("after")}>30일 후</button></div>
    <div className="progress-card"><div><span>{phase === "before" ? "처음 모습" : "달라진 모습"}</span><strong>{placed} / {cards.length}장</strong></div><div><i style={{ width: `${Math.round((placed / Math.max(cards.length, 1)) * 100)}%` }} /></div></div>
    {!members.length && <div className="empty-hint">우리집 메뉴에서 가족 호칭을 먼저 입력해 주세요.</div>}
    <div className="card-stack">{cards.map((card, index) => <article className={`chore-row ${card.invisible ? "invisible-work" : ""}`} key={card.id}>
      <div className="card-number">{String(index + 1).padStart(2, "0")}</div><div className="card-copy"><div><strong>{card.name}</strong>{card.invisible && <span>보이지 않는 일</span>}{card.kid && <span className="kid-tag">아이도 가능</span>}</div><p>알아채기 · {card.notice}</p></div>
      <select value={map?.[card.id] || ""} onChange={(event) => assign(card.id, event.target.value)} aria-label={`${card.name} 담당자`}><option value="">담당자</option>{members.map((member) => <option key={member.id} value={member.id}>{member.nickname}</option>)}<option value="together">함께</option><option value="none">아무도 안 함</option></select>
    </article>)}</div>
  </div>;
}

function WeekTab({ family, cards, members, update }: { family: FamilyRecord; cards: ChoreCard[]; members: Member[]; update: (next: FamilyRecord) => void }) {
  const [weekIndex, setWeekIndex] = useState(0); const week = family.weeks[weekIndex];
  const patchWeek = (patch: Partial<FamilyRecord["weeks"][number]>) => update({ ...family, weeks: family.weeks.map((item, index) => index === weekIndex ? { ...item, ...patch } : item) });
  function toggle(memberId: string, day: number) { const checks = [...(week.checks[memberId] || Array(7).fill(false))]; checks[day] = !checks[day]; patchWeek({ checks: { ...week.checks, [memberId]: checks } }); }
  return <div>
    <SectionHead eyebrow="STEP 2" title="이번 주 작은 약속" description="한 가지씩 골라 7일 동안 가볍게 실천해 보세요." />
    <div className="week-tabs">{WEEK_INFO.map((info, index) => <button key={info.label} className={weekIndex === index ? "active" : ""} onClick={() => setWeekIndex(index)}><strong>{info.label}</strong><span>{index + 1}</span></button>)}</div>
    <div className="week-banner"><img src={IMAGES.calling} alt="힘차게 외치는 해온이" /><div><span>{WEEK_INFO[weekIndex].period}</span><strong>우리 가족의 약속을 정해볼까?</strong></div></div>
    <div className="promise-list">{members.map((member) => { const pick = week.picks[member.id] || { cardId: "", promise: "" }; const checks = week.checks[member.id] || Array(7).fill(false); const pool = member.kid ? cards.filter((card) => card.kid) : cards; return <article className="promise-card" key={member.id}>
      <header><span className={`avatar ${member.kid ? "kid" : ""}`}>{member.nickname.slice(0, 1)}</span><strong>{member.nickname}</strong><small>{checks.filter(Boolean).length}/7일</small></header>
      <select value={pick.cardId} onChange={(event) => patchWeek({ picks: { ...week.picks, [member.id]: { ...pick, cardId: event.target.value } } })}><option value="">실천할 카드 고르기</option>{pool.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select>
      <input value={pick.promise} onChange={(event) => patchWeek({ picks: { ...week.picks, [member.id]: { ...pick, promise: event.target.value } } })} placeholder="나의 작은 약속을 적어 주세요" />
      <div className="day-checks">{checks.map((checked, day) => <button key={day} className={checked ? "checked" : ""} onClick={() => toggle(member.id, day)} aria-label={`${member.nickname} ${day + 1}일차 ${checked ? "완료 취소" : "완료"}`}><span>{checked ? "✓" : day + 1}</span><small>일</small></button>)}</div>
    </article>; })}</div>
    <div className="thanks-card"><p>이번 주 고마웠던 가족</p><div className="thanks-pills">{members.map((member) => <button key={member.id} className={week.thanks.memberId === member.id ? "active" : ""} onClick={() => patchWeek({ thanks: { ...week.thanks, memberId: member.id } })}>{member.nickname}</button>)}</div><input value={week.thanks.note} onChange={(event) => patchWeek({ thanks: { ...week.thanks, note: event.target.value } })} placeholder="어떤 점이 고마웠나요?" /></div>
  </div>;
}

function ReportTab({ family, cards, members, stats }: { family: FamilyRecord; cards: ChoreCard[]; members: Member[]; stats: { done: number; total: number; rate: number } }) {
  const ownerKeys = [...members.map((member) => member.id), "together", "none"];
  const tally = (map: Record<string, string>) => ownerKeys.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: Object.values(map || {}).filter((owner) => owner === key).length }), {});
  const before = tally(family.placementBefore); const after = tally(family.placementAfter); const thanks = family.weeks.filter((week) => week.thanks.note.trim()); const invisibleCount = cards.filter((card) => card.invisible).length;
  return <div>
    <SectionHead eyebrow="STEP 3" title="우리집의 변화" description="처음과 지금을 비교하고 서로의 수고를 발견해 보세요." />
    <div className="report-hero"><div><span>4주 실천율</span><strong>{stats.rate}%</strong><p>{stats.rate >= 80 ? "멋져요! 우리 가족 인증 완료" : "하나씩 체크할 때마다 변화가 쌓여요."}</p></div><img src={stats.rate >= 80 ? IMAGES.suit : IMAGES.cheer} alt="응원하는 해온이" /></div>
    <div className="report-grid"><article><span>실천 스티커</span><strong>{stats.done}<small>개</small></strong></article><article><span>발견한 집안일</span><strong>{Object.keys(family.placementBefore).length}<small>개</small></strong></article><article><span>보이지 않는 일</span><strong>{invisibleCount}<small>개</small></strong></article></div>
    <div className="panel comparison-panel"><div className="panel-title"><div><p>담당 카드 변화</p><span>시작 전 → 30일 후</span></div></div>{ownerKeys.map((key) => <div className="comparison-row" key={key}><strong><OwnerName owner={key} members={members} /></strong><span>{before[key] || 0}장</span><i>→</i><span className={(after[key] || 0) !== (before[key] || 0) ? "changed" : ""}>{after[key] || 0}장</span></div>)}</div>
    <div className="panel"><div className="panel-title"><div><p>고마움을 나눈 순간</p><span>서로에게 남긴 따뜻한 기록이에요.</span></div></div>{thanks.length ? <div className="thanks-notes">{thanks.map((week, index) => <blockquote key={index}><span>{index + 1}주차</span><p>“{week.thanks.note}”</p><small><OwnerName owner={week.thanks.memberId} members={members} />에게</small></blockquote>)}</div> : <div className="empty-hint">아직 기록이 없어요. 이번 주 메뉴에서 고마운 마음을 남겨보세요.</div>}</div>
  </div>;
}
