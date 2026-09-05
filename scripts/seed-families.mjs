import { createHash, randomInt } from "node:crypto";

const projectId = "seogu-safety-map";
const collectionName = "hamkkeFamilies";
const accessToken = process.env.FIREBASE_ACCESS_TOKEN;
if (!accessToken) throw new Error("FIREBASE_ACCESS_TOKEN이 필요합니다.");

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const resourceRoot = `projects/${projectId}/databases/(default)/documents`;
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

function blankPhase() {
  return {
    cards: {},
    customTitles: {},
    indexAnswers: {
      adult1: Array(10).fill(null),
      adult2: Array(10).fill(null),
    },
    times: {
      adult1: { housework: "", mental: "", rest: "" },
      adult2: { housework: "", mental: "", rest: "" },
    },
    satisfaction: { ratings: Array(5).fill(null), feedback: "" },
    status: "draft",
  };
}

function firestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number")
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(firestoreValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]),
      ),
    },
  };
}

function fields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]),
  );
}

const listResponse = await fetch(`${baseUrl}/${collectionName}?pageSize=100`, {
  headers,
});
if (!listResponse.ok && listResponse.status !== 404)
  throw new Error(`가정 목록 확인 실패: ${listResponse.status}`);
const list = listResponse.ok ? await listResponse.json() : {};
const existing = new Set(
  (list.documents || [])
    .map((document) => Number(document.fields?.familyNo?.integerValue))
    .filter(Boolean),
);
const usedPins = new Set(
  (list.documents || [])
    .map((document) => document.fields?.accessPin?.stringValue)
    .filter(Boolean),
);
const now = new Date().toISOString();
const writes = [];

for (let familyNo = 1; familyNo <= 30; familyNo++) {
  if (existing.has(familyNo)) continue;
  let pin;
  do pin = String(randomInt(100000, 1000000));
  while (usedPins.has(pin));
  usedPins.add(pin);
  const id = createHash("sha256")
    .update(`hamkke-family-v1:${familyNo}:${pin}`)
    .digest("hex");
  const family = {
    familyNo,
    accessPin: pin,
    ownerUid: "",
    familyName: "",
    familyType: "children",
    adults: { adult1: "", adult2: "" },
    children: [],
    changeWish: "",
    pre: blankPhase(),
    post: blankPhase(),
    completionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  writes.push({
    update: {
      name: `${resourceRoot}/${collectionName}/${id}`,
      fields: fields(family),
    },
    currentDocument: { exists: false },
  });
}

if (writes.length) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ writes }),
    },
  );
  if (!response.ok)
    throw new Error(
      `가정 생성 실패: ${response.status} ${await response.text()}`,
    );
}

console.log(`${writes.length}개 가정 접속번호 생성 완료`);
