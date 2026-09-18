import { env } from "cloudflare:workers";
import type { FamilyPhoto } from "../../data";

const PROJECT_ID = "seogu-safety-map";
const COLLECTION = "hamkkeFamilies";
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

type R2ObjectBodyLike = {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
};

type PhotoBucket = {
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(key: string): Promise<void>;
};

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function bucket() {
  const value = (env as unknown as { FAMILY_PHOTOS?: PhotoBucket })
    .FAMILY_PHOTOS;
  if (!value) throw new Error("photo-storage-unavailable");
  return value;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function normalizeName(value: string) {
  return value.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

function stringField(fields: Record<string, FirestoreValue>, key: string) {
  return fields[key]?.stringValue || "";
}

function booleanField(fields: Record<string, FirestoreValue>, key: string) {
  return fields[key]?.booleanValue === true;
}

function numberField(fields: Record<string, FirestoreValue>, key: string) {
  return Number(fields[key]?.integerValue || 0);
}

function photoFromDocument(document: FirestoreDocument): FamilyPhoto | undefined {
  const fields = document.fields?.familyPhoto?.mapValue?.fields;
  if (!fields) return undefined;
  const storagePath = stringField(fields, "storagePath");
  if (!storagePath) return undefined;
  return {
    storagePath,
    downloadUrl: stringField(fields, "downloadUrl"),
    contentType: stringField(fields, "contentType"),
    size: numberField(fields, "size"),
    internalConsent: true,
    publicityConsent: booleanField(fields, "publicityConsent"),
    uploadedAt: stringField(fields, "uploadedAt"),
  };
}

async function verifyFamily(request: Request, familyNo: number, name: string) {
  const token = bearerToken(request);
  if (!token || !Number.isInteger(familyNo) || familyNo < 1 || !name.trim()) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: COLLECTION }],
          where: {
            fieldFilter: {
              field: { fieldPath: "familyNo" },
              op: "EQUAL",
              value: { integerValue: String(familyNo) },
            },
          },
          limit: 1,
        },
      }),
    },
  );
  if (!response.ok) throw new Response("Unauthorized", { status: 401 });
  const rows = (await response.json()) as { document?: FirestoreDocument }[];
  const document = rows.find((row) => row.document)?.document;
  if (!document) throw new Response("Not found", { status: 404 });

  const values =
    document.fields?.authorizedNames?.arrayValue?.values
      ?.map((value) => value.stringValue || "")
      .filter(Boolean) || [];
  const applicantName = document.fields?.applicantName?.stringValue;
  if (applicantName) values.push(applicantName);
  const normalized = normalizeName(name);
  if (!values.some((value) => normalizeName(value) === normalized)) {
    throw new Response("Forbidden", { status: 403 });
  }

  return {
    token,
    document,
    documentId: document.name.split("/").pop() || "",
    photo: photoFromDocument(document),
  };
}

function photoValue(photo: FamilyPhoto): FirestoreValue {
  return {
    mapValue: {
      fields: {
        storagePath: { stringValue: photo.storagePath },
        downloadUrl: { stringValue: photo.downloadUrl },
        contentType: { stringValue: photo.contentType },
        size: { integerValue: String(photo.size) },
        internalConsent: { booleanValue: true },
        publicityConsent: { booleanValue: photo.publicityConsent },
        uploadedAt: { stringValue: photo.uploadedAt },
      },
    },
  };
}

async function savePhoto(
  token: string,
  documentId: string,
  photo?: FamilyPhoto,
) {
  const updateMask = new URLSearchParams();
  updateMask.append("updateMask.fieldPaths", "familyPhoto");
  updateMask.append("updateMask.fieldPaths", "updatedAt");
  const fields: Record<string, FirestoreValue> = {
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  if (photo) fields.familyPhoto = photoValue(photo);

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${encodeURIComponent(documentId)}?${updateMask}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    },
  );
  if (!response.ok) throw new Error(`firestore-update-${response.status}`);
}

function safeExtension(file: File) {
  const known: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  return known[file.type] || "img";
}

export async function GET(request: Request) {
  try {
    const key = new URL(request.url).searchParams.get("key") || "";
    if (!key.startsWith("families/") || key.includes("..")) {
      return new Response("Not found", { status: 404 });
    }
    const object = await bucket().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function POST(request: Request) {
  let uploadedKey = "";
  try {
    const form = await request.formData();
    const file = form.get("photo");
    const familyNo = Number(form.get("familyNo"));
    const name = String(form.get("name") || "");
    if (form.get("internalConsent") !== "true") {
      return json({ error: "사진 보관 동의가 필요합니다." }, 400);
    }
    if (!(file instanceof File) || !file.type.startsWith("image/")) {
      return json({ error: "사진 파일만 등록할 수 있습니다." }, 400);
    }
    if (!file.size || file.size > MAX_PHOTO_SIZE) {
      return json({ error: "사진은 10MB 이하여야 합니다." }, 400);
    }
    const verified = await verifyFamily(request, familyNo, name);
    uploadedKey = `families/${verified.documentId}/${crypto.randomUUID()}.${safeExtension(file)}`;
    await bucket().put(uploadedKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    const photo: FamilyPhoto = {
      storagePath: uploadedKey,
      downloadUrl: `/api/family-photo?key=${encodeURIComponent(uploadedKey)}`,
      contentType: file.type,
      size: file.size,
      internalConsent: true,
      publicityConsent: form.get("publicityConsent") === "true",
      uploadedAt: new Date().toISOString(),
    };
    await savePhoto(verified.token, verified.documentId, photo);
    if (verified.photo?.storagePath) {
      await bucket().delete(verified.photo.storagePath).catch(() => undefined);
    }
    return json({ photo });
  } catch (error) {
    if (uploadedKey) await bucket().delete(uploadedKey).catch(() => undefined);
    if (error instanceof Response) return error;
    return json({ error: "사진을 등록하지 못했습니다." }, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      familyNo?: number;
      name?: string;
      publicityConsent?: boolean;
    };
    const verified = await verifyFamily(
      request,
      Number(body.familyNo),
      String(body.name || ""),
    );
    if (!verified.photo) return json({ error: "등록된 사진이 없습니다." }, 404);
    const photo = {
      ...verified.photo,
      publicityConsent: body.publicityConsent === true,
    };
    await savePhoto(verified.token, verified.documentId, photo);
    return json({ photo });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "동의 선택을 저장하지 못했습니다." }, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { familyNo?: number; name?: string };
    const verified = await verifyFamily(
      request,
      Number(body.familyNo),
      String(body.name || ""),
    );
    await savePhoto(verified.token, verified.documentId);
    if (verified.photo?.storagePath) {
      await bucket().delete(verified.photo.storagePath);
    }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "사진을 삭제하지 못했습니다." }, 500);
  }
}
