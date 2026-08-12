"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChoreCard, FamilyRecord } from "../data";
import { DEFAULT_CARDS, WEEK_INFO } from "../data";

function familyStats(family: FamilyRecord) {
  let done = 0;
  let total = 0;
  for (const week of family.weeks || []) {
    for (const checks of Object.values(week.checks || {})) {
      total += 7;
      done += (checks || []).filter(Boolean).length;
    }
  }
  return { done, rate: total ? Math.round((done / total) * 100) : 0 };
}

export default function AdminApp() {
  const [pin, setPin] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<"overview" | "cards">("overview");
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [cards, setCards] = useState<ChoreCard[]>(DEFAULT_CARDS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<FamilyRecord | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("haeoni-admin-pin");
    if (saved) { setPin(saved); void authenticate(saved); }
  }, []);

  async function authenticate(value = pin) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "관리자 번호를 확인해 주세요.");
      sessionStorage.setItem("haeoni-admin-pin", value);
      setPin(value); setAuthorized(true);
      await loadData(value);
    } catch (error) {
      sessionStorage.removeItem("haeoni-admin-pin");
      setAuthorized(false); setMessage(error instanceof Error ? error.message : "관리자 번호를 확인해 주세요.");
    } finally { setBusy(false); }
  }

  async function loadData(value = pin) {
    const headers = { "x-admin-pin": value };
    const [summaryResponse, cardsResponse] = await Promise.all([fetch("/api/admin/summary", { headers }), fetch("/api/admin/cards", { headers })]);
    const [summary, cardData] = await Promise.all([summaryResponse.json(), cardsResponse.json()]);
    if (!summaryResponse.ok) throw new Error(summary.error || "현황을 불러오지 못했습니다.");
    setFamilies(Array.isArray(summary.families) ? summary.families : []);
    if (cardsResponse.ok && Array.isArray(cardData.cards) && cardData.cards.length) setCards(cardData.cards);
  }

  async function saveCards() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/cards", { method: "PUT", headers: { "content-type": "application/json", "x-admin-pin": pin }, body: JSON.stringify({ cards }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "카드를 저장하지 못했습니다.");
      setCards(data.cards); setMessage("카드 구성을 저장했습니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "카드를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function deleteFamily(no: string) {
    if (!window.confirm(`${no}번 가정 기록을 삭제할까요? 삭제 후 복구할 수 없습니다.`)) return;
    const response = await fetch(`/api/admin/families/${no}`, { method: "DELETE", headers: { "x-admin-pin": pin } });
    if (response.ok) setFamilies((current) => current.filter((family) => family.no !== no));
    else setMessage("가정 기록을 삭제하지 못했습니다.");
  }

  function exportCsv() {
    const header = ["가정번호", "가족 수", "시작 전 배치", "30일 후 배치", "스티커", "실천율", "최근 저장"];
    const rows = families.map((family) => { const stats = familyStats(family); return [family.no, family.members.filter((m) => m.nickname).length, Object.keys(family.placementBefore || {}).length, Object.keys(family.placementAfter || {}).length, stats.done, `${stats.rate}%`, family.updatedAt || ""]; });
    const csv = "\uFEFF" + [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `반반한가정_참여현황_${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!authorized) return <main className="admin-login"><section><a href="/" className="back-link">← 가족용 화면</a><div className="admin-login-visual"><img src="/assets/haeoni-suit-point.png" alt="안내하는 해온이" /></div><p className="eyebrow">반반한 가정 ADMIN</p><h1>관리자 화면</h1><p>관리자 번호를 입력하면 참여 가정의 저장 기록과 집안일 카드를 관리할 수 있습니다.</p><label htmlFor="admin-pin">관리자 번호</label><input id="admin-pin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => event.key === "Enter" && void authenticate()} placeholder="번호 입력" /><button onClick={() => void authenticate()} disabled={!pin || busy}>{busy ? "확인 중…" : "관리자 화면 열기"}</button>{message && <div className="error-text" role="alert">{message}</div>}</section></main>;

  const completed = families.filter((family) => familyStats(family).rate >= 80).length;
  const totalStickers = families.reduce((sum, family) => sum + familyStats(family).done, 0);
  return <main className="admin-canvas">
    <aside className="admin-sidebar"><a href="/" className="admin-logo"><img src="/assets/seo-gu-symbol.png" alt="" /><span><strong>반반한 가정</strong><small>관리자</small></span></a><nav><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>참여 현황</button><button className={tab === "cards" ? "active" : ""} onClick={() => setTab("cards")}>집안일 카드</button></nav><img className="admin-character" src="/assets/haeoni-suit-cheer.png" alt="두 팔을 든 해온이" /><button className="logout" onClick={() => { sessionStorage.removeItem("haeoni-admin-pin"); setAuthorized(false); setPin(""); }}>로그아웃</button></aside>
    <section className="admin-workspace">
      <header className="admin-top"><div><p>전남광주통합특별시</p><h1>{tab === "overview" ? "참여 현황" : "집안일 카드 관리"}</h1></div><div><button className="secondary" onClick={() => void loadData()} disabled={busy}>새로고침</button>{tab === "overview" ? <button onClick={exportCsv}>엑셀용 자료 받기</button> : <button onClick={() => void saveCards()} disabled={busy}>{busy ? "저장 중…" : "전체 저장"}</button>}</div></header>
      {message && <div className="admin-message" role="status">{message}</div>}
      {tab === "overview" && <div className="admin-message" role="note">가족용 화면에서 저장된 가정번호·가족 호칭·카드 배치·실천 스티커·최근 저장 기록이 이 화면에 자동 반영됩니다.</div>}
      {tab === "overview" ? <>
        <div className="admin-stats"><article><span>참여 가정</span><strong>{families.length}</strong><small>가정</small></article><article><span>완주 예정</span><strong>{completed}</strong><small>가정</small></article><article><span>실천 스티커</span><strong>{totalStickers}</strong><small>개</small></article><article><span>운영 카드</span><strong>{cards.length}</strong><small>장</small></article></div>
        <div className="admin-table-card"><div className="table-head"><div><strong>가정별 진행 현황</strong><span>상세보기를 누르면 구성원별 카드·약속·실천 기록을 모두 확인할 수 있습니다.</span></div><button onClick={exportCsv}>CSV 내려받기</button></div>{families.length ? <div className="family-table"><div className="family-table-row labels"><span>가정번호</span><span>구성원</span><span>카드 배치</span><span>스티커</span><span>실천율</span><span>관리</span></div>{families.map((family) => { const stats = familyStats(family); return <div className="family-table-row" key={family.no}><strong>{family.no}번</strong><span>{family.members.filter((m) => m.nickname).map((m) => m.nickname).join(" · ") || "미입력"}</span><span>{Object.keys(family.placementBefore || {}).length} / {cards.length}</span><span>{stats.done}개</span><span><i className="rate-bar"><b style={{ width: `${stats.rate}%` }} /></i>{stats.rate}%</span><div className="family-row-actions"><button onClick={() => setSelectedFamily(family)}>상세보기</button><button className="danger" onClick={() => void deleteFamily(family.no)}>삭제</button></div></div>; })}</div> : <div className="admin-empty"><img src="/assets/haeoni-red-cheer.png" alt="기다리는 해온이" /><strong>아직 참여 기록이 없습니다.</strong><p>가족이 가정번호로 시작하면 여기에 표시됩니다.</p></div>}</div>
      </> : <CardManager cards={cards} setCards={setCards} onSave={saveCards} busy={busy} />}
    </section>
    {selectedFamily && <FamilyDetail family={selectedFamily} cards={cards} onClose={() => setSelectedFamily(null)} />}
  </main>;
}

function FamilyDetail({ family, cards, onClose }: { family: FamilyRecord; cards: ChoreCard[]; onClose: () => void }) {
  const stats = familyStats(family);
  const memberName = (memberId: string) => {
    if (memberId === "together") return "가족이 함께";
    if (memberId === "none") return "담당 없음";
    return family.members.find((member) => member.id === memberId)?.nickname || "미입력 구성원";
  };
  const cardName = (cardId?: string) => cards.find((card) => card.id === cardId)?.name || "선택 안 함";
  const savedAt = family.updatedAt ? new Date(family.updatedAt).toLocaleString("ko-KR") : "저장 시각 없음";

  return <div className="detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="family-detail" role="dialog" aria-modal="true" aria-labelledby="family-detail-title">
      <header className="detail-header"><div><p>가정별 전체 기록</p><h2 id="family-detail-title">{family.no}번 가정 상세</h2><span>{savedAt} 기준</span></div><button type="button" onClick={onClose} aria-label="상세 화면 닫기">닫기 ×</button></header>
      <div className="detail-summary">
        <article><span>구성원</span><strong>{family.members.filter((member) => member.nickname).map((member) => member.nickname).join(" · ") || "미입력"}</strong></article>
        <article><span>실천 스티커</span><strong>{stats.done}개</strong></article>
        <article><span>전체 실천율</span><strong>{stats.rate}%</strong></article>
      </div>

      <section className="detail-section">
        <div className="detail-section-title"><div><span>01</span><h3>집안일 카드 배치 전후</h3></div><p>모든 카드의 담당자가 어떻게 달라졌는지 확인합니다.</p></div>
        <div className="placement-detail-grid">
          {([{ title: "시작 전", placement: family.placementBefore || {} }, { title: "30일 후", placement: family.placementAfter || {} }] as const).map((phase) => <article className="placement-phase" key={phase.title}><header><strong>{phase.title}</strong><span>{Object.keys(phase.placement).length}장 배치</span></header><div className="assignment-list">{cards.map((card) => <div className="assignment-row" key={card.id}><span>{card.name}</span><strong className={phase.placement[card.id] ? "" : "empty"}>{phase.placement[card.id] ? memberName(phase.placement[card.id]) : "미배치"}</strong></div>)}</div></article>)}
        </div>
      </section>

      <section className="detail-section">
        <div className="detail-section-title"><div><span>02</span><h3>주차별 구성원 실천 기록</h3></div><p>각 구성원이 선택한 카드, 작성한 약속, 요일별 실천을 모두 표시합니다.</p></div>
        <div className="week-detail-list">{WEEK_INFO.map((weekInfo, weekIndex) => {
          const week = family.weeks?.[weekIndex];
          const thankedMember = week?.thanks?.memberId ? memberName(week.thanks.memberId) : "선택 안 함";
          return <article className="week-detail-card" key={weekInfo.label}><header><div><strong>{weekInfo.label}</strong><span>{weekInfo.period}</span></div><small>{Object.values(week?.checks || {}).flat().filter(Boolean).length}개 실천</small></header><div className="member-week-list">{family.members.map((member) => {
            const pick = week?.picks?.[member.id];
            const checks = week?.checks?.[member.id] || [];
            return <section className="member-week-row" key={member.id}><div className="member-week-name"><strong>{member.nickname || "미입력 구성원"}</strong>{member.kid && <span>아이</span>}</div><dl><div><dt>선택한 카드</dt><dd>{cardName(pick?.cardId)}</dd></div><div><dt>작성한 약속</dt><dd>{pick?.promise?.trim() || "작성 안 함"}</dd></div></dl><div className="detail-checks" aria-label={`${member.nickname || "구성원"}의 요일별 실천`}><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span>{Array.from({ length: 7 }, (_, dayIndex) => <b className={checks[dayIndex] ? "done" : ""} key={dayIndex}>{checks[dayIndex] ? "✓" : "–"}</b>)}</div></section>;
          })}</div><footer className="thanks-detail"><span>고마운 가족</span><strong>{thankedMember}</strong><p>{week?.thanks?.note?.trim() || "작성 안 함"}</p></footer></article>;
        })}</div>
      </section>
    </section>
  </div>;
}

function CardManager({ cards, setCards, onSave, busy }: { cards: ChoreCard[]; setCards: (cards: ChoreCard[]) => void; onSave: () => Promise<void>; busy: boolean }) {
  const [openId, setOpenId] = useState<string | null>(cards[0]?.id || null);
  const counts = useMemo(() => ({ invisible: cards.filter((card) => card.invisible).length, kid: cards.filter((card) => card.kid).length }), [cards]);
  const patchCard = (id: string, patch: Partial<ChoreCard>) => setCards(cards.map((card) => card.id === id ? { ...card, ...patch } : card));
  function move(index: number, offset: number) { const target = index + offset; if (target < 0 || target >= cards.length) return; const next = [...cards]; [next[index], next[target]] = [next[target], next[index]]; setCards(next.map((card, position) => ({ ...card, position }))); }
  return <div className="card-admin-layout"><div className="card-admin-summary"><div><span>전체 카드</span><strong>{cards.length}장</strong></div><div><span>보이지 않는 일</span><strong>{counts.invisible}장</strong></div><div><span>아이도 가능</span><strong>{counts.kid}장</strong></div><p>카드 이름과 세 단계를 수정하거나 새 카드를 추가할 수 있습니다. 변경 후 반드시 전체 저장을 눌러 주세요.</p><button onClick={() => void onSave()} disabled={busy}>{busy ? "저장 중…" : "전체 저장"}</button></div><div className="card-admin-list">
    {cards.map((card, index) => <article key={card.id} className={openId === card.id ? "open" : ""}><header><span>{String(index + 1).padStart(2, "0")}</span><strong>{card.name || "새 카드"}</strong><div>{card.invisible && <i>보이지 않는 일</i>}{card.kid && <i className="kid">아이</i>}</div><button onClick={() => setOpenId(openId === card.id ? null : card.id)}>{openId === card.id ? "접기" : "수정"}</button></header>{openId === card.id && <div className="card-admin-fields"><label>카드 이름<input value={card.name} onChange={(event) => patchCard(card.id, { name: event.target.value })} /></label><div className="field-grid"><label>알아채기<input value={card.notice} onChange={(event) => patchCard(card.id, { notice: event.target.value })} /></label><label>준비하기<input value={card.prepare} onChange={(event) => patchCard(card.id, { prepare: event.target.value })} /></label><label>실행하기<input value={card.action} onChange={(event) => patchCard(card.id, { action: event.target.value })} /></label></div><div className="card-admin-actions"><label><input type="checkbox" checked={card.invisible} onChange={(event) => patchCard(card.id, { invisible: event.target.checked })} />보이지 않는 일</label><label><input type="checkbox" checked={card.kid} onChange={(event) => patchCard(card.id, { kid: event.target.checked })} />아이도 가능</label><span /><button onClick={() => move(index, -1)} disabled={index === 0}>위로</button><button onClick={() => move(index, 1)} disabled={index === cards.length - 1}>아래로</button><button className="danger" onClick={() => setCards(cards.filter((item) => item.id !== card.id))}>삭제</button></div></div>}</article>)}
    <button className="add-card" onClick={() => { const card = { id: `c${Date.now()}`, name: "새 집안일", notice: "", prepare: "", action: "", kid: false, invisible: false, position: cards.length }; setCards([...cards, card]); setOpenId(card.id); }}>+ 새 카드 추가</button>
  </div></div>;
}
