"use client";

import { ChangeEvent, useRef, useState } from "react";
import { FamilyPhoto, FamilyRecord } from "../../data";
import { auth } from "../../firebase";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

export function FamilyPhotoCard({
  family,
  onChange,
}: {
  family: FamilyRecord;
  onChange: (photo?: FamilyPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalConsent, setInternalConsent] = useState(
    Boolean(family.familyPhoto?.internalConsent),
  );
  const [publicityConsent, setPublicityConsent] = useState(
    Boolean(family.familyPhoto?.publicityConsent),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function authorizationHeader() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("not-signed-in");
    return { Authorization: `Bearer ${token}` };
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!family._docId) {
      setNotice("가정 정보를 불러온 뒤 다시 시도해주세요.");
      return;
    }
    if (!internalConsent) {
      setNotice("사업 운영을 위한 사진 보관 동의를 확인해주세요.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setNotice("사진 파일만 등록할 수 있어요.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setNotice("사진은 10MB 이하로 등록해주세요.");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("familyNo", String(family.familyNo));
      formData.set("name", sessionStorage.getItem("hamkkeApplicantName") || "");
      formData.set("internalConsent", String(internalConsent));
      formData.set("publicityConsent", String(publicityConsent));
      formData.set("photo", file);
      const response = await fetch("/api/family-photo", {
        method: "POST",
        headers: await authorizationHeader(),
        body: formData,
      });
      if (!response.ok) throw new Error("upload-failed");
      const { photo } = (await response.json()) as { photo: FamilyPhoto };
      setPublicityConsent(photo.publicityConsent);
      onChange(photo);
      setNotice("가족사진을 등록했어요.");
    } catch {
      setNotice("사진을 등록하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function changePublicityConsent(value: boolean) {
    if (!family._docId || !family.familyPhoto) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/family-photo", {
        method: "PATCH",
        headers: {
          ...(await authorizationHeader()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyNo: family.familyNo,
          name: sessionStorage.getItem("hamkkeApplicantName") || "",
          publicityConsent: value,
        }),
      });
      if (!response.ok) throw new Error("consent-save-failed");
      const { photo } = (await response.json()) as { photo: FamilyPhoto };
      setPublicityConsent(photo.publicityConsent);
      onChange(photo);
      setNotice("홍보 활용 동의 선택을 저장했어요.");
    } catch {
      setNotice("동의 선택을 저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!family._docId || !family.familyPhoto) return;
    if (!window.confirm("등록한 가족사진을 삭제할까요?")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/family-photo", {
        method: "DELETE",
        headers: {
          ...(await authorizationHeader()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyNo: family.familyNo,
          name: sessionStorage.getItem("hamkkeApplicantName") || "",
        }),
      });
      if (!response.ok) throw new Error("delete-failed");
      onChange(undefined);
      setInternalConsent(false);
      setPublicityConsent(false);
      setNotice("가족사진을 삭제했어요.");
    } catch {
      setNotice("사진을 삭제하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="family-photo-card" aria-labelledby="family-photo-title">
      <div className="family-photo-copy">
        <span className="section-kicker">선택 사항</span>
        <h2 id="family-photo-title">우리 가족 사진</h2>
        <p>대표 사진 1장을 등록할 수 있어요.</p>
        <small>등록한 사진은 리포트에 자동으로 들어가지 않아요.</small>
      </div>

      <div className="family-photo-preview">
        {family.familyPhoto ? (
          <img src={family.familyPhoto.downloadUrl} alt="등록한 가족사진" />
        ) : (
          <div aria-hidden="true">
            <span />
            <i />
          </div>
        )}
      </div>

      <div className="family-photo-controls">
        {!family.familyPhoto && (
          <label className="photo-consent primary-consent">
            <input
              type="checkbox"
              checked={internalConsent}
              onChange={(event) => setInternalConsent(event.target.checked)}
            />
            <span>사업 운영을 위한 사진 보관에 동의합니다.</span>
          </label>
        )}

        <label className="photo-consent">
          <input
            type="checkbox"
            checked={publicityConsent}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.checked;
              setPublicityConsent(value);
              if (family.familyPhoto) changePublicityConsent(value);
            }}
          />
          <span>구정 홍보물·SNS 활용에 동의합니다. (선택)</span>
        </label>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={uploadPhoto}
        />
        <div className="family-photo-actions">
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy
              ? "처리 중…"
              : family.familyPhoto
                ? "사진 바꾸기"
                : "사진 등록"}
          </button>
          {family.familyPhoto && (
            <button
              type="button"
              className="photo-delete-button"
              disabled={busy}
              onClick={removePhoto}
            >
              삭제
            </button>
          )}
        </div>
        {notice && (
          <p className="photo-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
