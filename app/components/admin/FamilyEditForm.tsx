"use client";

import { FormEvent, useState } from "react";
import { FamilyRecord } from "../../data";

export type FamilyEdits = Pick<
  FamilyRecord,
  | "applicantName"
  | "familyType"
  | "adults"
  | "changeWish"
  | "completionCount"
  | "pre"
  | "post"
>;

export function FamilyEditForm({
  family,
  onSave,
  onCancel,
}: {
  family: FamilyRecord;
  onSave: (edits: FamilyEdits) => Promise<void>;
  onCancel: () => void;
}) {
  const [applicantName, setApplicantName] = useState(
    family.applicantName || "",
  );
  const [adult1, setAdult1] = useState(family.adults.adult1 || "");
  const [adult2, setAdult2] = useState(family.adults.adult2 || "");
  const [familyType, setFamilyType] = useState(family.familyType);
  const [changeWish, setChangeWish] = useState(family.changeWish || "");
  const [completionCount, setCompletionCount] = useState(
    family.completionCount || 0,
  );
  const [preStatus, setPreStatus] = useState(family.pre.status);
  const [postStatus, setPostStatus] = useState(family.post.status);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave({
        applicantName: applicantName.trim(),
        familyType,
        adults: { adult1: adult1.trim(), adult2: adult2.trim() },
        changeWish: changeWish.trim(),
        completionCount: Math.max(0, completionCount),
        pre: { ...family.pre, status: preStatus },
        post: { ...family.post, status: postStatus },
      });
      onCancel();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-edit-form" onSubmit={submit}>
      <h3>가정 정보 수정</h3>
      <div className="admin-edit-grid">
        <label>
          신청자 이름
          <input
            value={applicantName}
            onChange={(event) => setApplicantName(event.target.value)}
          />
        </label>
        <label>
          성인 1
          <input
            value={adult1}
            onChange={(event) => setAdult1(event.target.value)}
          />
        </label>
        <label>
          성인 2
          <input
            value={adult2}
            onChange={(event) => setAdult2(event.target.value)}
          />
        </label>
        <label>
          가정 유형
          <select
            value={familyType}
            onChange={(event) =>
              setFamilyType(event.target.value as FamilyRecord["familyType"])
            }
          >
            <option value="children">자녀가 있어요</option>
            <option value="childless">자녀가 없어요</option>
          </select>
        </label>
        <label>
          사전 상태
          <select
            value={preStatus}
            onChange={(event) =>
              setPreStatus(event.target.value as "draft" | "submitted")
            }
          >
            <option value="draft">작성중</option>
            <option value="submitted">제출</option>
          </select>
        </label>
        <label>
          사후 상태
          <select
            value={postStatus}
            onChange={(event) =>
              setPostStatus(event.target.value as "draft" | "submitted")
            }
          >
            <option value="draft">작성중</option>
            <option value="submitted">제출</option>
          </select>
        </label>
        <label>
          활동 인증 횟수
          <input
            type="number"
            min="0"
            value={completionCount}
            onChange={(event) => setCompletionCount(Number(event.target.value))}
          />
        </label>
        <label className="full">
          우리 가족이 바꿔보고 싶은 점
          <textarea
            value={changeWish}
            onChange={(event) => setChangeWish(event.target.value)}
          />
        </label>
      </div>
      <div className="admin-edit-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          취소
        </button>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "저장 중…" : "수정 저장"}
        </button>
      </div>
    </form>
  );
}
