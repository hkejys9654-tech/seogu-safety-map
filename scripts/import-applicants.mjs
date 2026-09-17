import { createHash, randomInt } from "node:crypto";
import XLSX from "xlsx";

const workbookPath = process.argv[2];
const projectId = process.env.FIREBASE_PROJECT_ID || "seogu-safety-map";
const accessToken = process.env.FIREBASE_ACCESS_TOKEN;
const collectionName = "hamkkeFamilies";

if (!workbookPath) {
  throw new Error("신청자 엑셀 파일 경로가 필요합니다.");
}
if (!accessToken) {
  throw new Error("FIREBASE_ACCESS_TOKEN이 필요합니다.");
}

const workbook = XLSX.readFile(workbookPath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
if (!rows.length) throw new Error("신청자 명단이 비어 있습니다.");

const headers = Object.keys(rows[0]);
const numberHeader = headers.find((header) => header.trim() === "번호");
const adult1Header = headers.find((header) =>
  header.trim().startsWith("참가자 정보 1"),
);
const adult2Header = headers.find((header) =>
  header.trim().startsWith("참가자 정보 2"),
);
if (!numberHeader || !adult1Header || !adult2Header) {
  throw new Error("번호와 참가자 정보 열을 찾지 못했습니다.");
}

const placeholders = new Set(["", ".", "0", "-", "없음", "없응", "해당없음"]);

function participantName(value) {
  const raw = String(value || "").trim();
  if (placeholders.has(raw)) return "";
  const first = raw.includes("/")
    ? raw.split("/")[0].trim()
    : raw.match(/^[가-힣A-Za-z·]{2,30}/)?.[0] || "";
  return placeholders.has(first) ? "" : first;
}

const applicants = rows.map((row, index) => {
  const familyNo = Number(String(row[numberHeader]).trim());
  const authorizedNames = [
    participantName(row[adult1Header]),
    participantName(row[adult2Header]),
  ].filter((name, nameIndex, all) => name && all.indexOf(name) === nameIndex);
  if (!Number.isInteger(familyNo) || familyNo < 1 || familyNo > 99) {
    throw new Error(`${index + 2}행의 가정번호를 확인해주세요.`);
  }
  if (!authorizedNames.length) {
    throw new Error(`${index + 2}행에서 접속 이름을 찾지 못했습니다.`);
  }
  return {
    familyNo,
    applicantName: authorizedNames[0],
    authorizedNames,
  };
});

if (new Set(applicants.map((item) => item.familyNo)).size !== applicants.length) {
  throw new Error("중복된 가정번호가 있습니다.");
}

const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const resourceRoot = `projects/${projectId}/databases/(default)/documents`;
const headersWithAuth = {
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
  if (value instanceof Date) return { timestampValue: value.toISOString() };
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

const listResponse = await fetch(`${baseUrl}/${collectionName}?pageSize=1000`, {
  headers: headersWithAuth,
});
if (!listResponse.ok && listResponse.status !== 404) {
  throw new Error(`가정 목록 확인 실패: ${listResponse.status}`);
}
const list = listResponse.ok ? await listResponse.json() : {};
const existingDocuments = list.documents || [];
const existingByNumber = new Map(
  existingDocuments.map((document) => [
    Number(document.fields?.familyNo?.integerValue),
    document,
  ]),
);
const usedPins = new Set(
  existingDocuments
    .map((document) => document.fields?.accessPin?.stringValue)
    .filter(Boolean),
);

const now = new Date();
let created = 0;
let updated = 0;
const writes = applicants.map((applicant) => {
  const existing = existingByNumber.get(applicant.familyNo);
  if (existing) {
    updated += 1;
    return {
      update: {
        name: existing.name,
        fields: fields({
          applicantName: applicant.applicantName,
          authorizedNames: applicant.authorizedNames,
          updatedAt: now,
        }),
      },
      updateMask: {
        fieldPaths: ["applicantName", "authorizedNames", "updatedAt"],
      },
      currentDocument: { exists: true },
    };
  }

  created += 1;
  let accessPin;
  do accessPin = String(randomInt(100000, 1000000));
  while (usedPins.has(accessPin));
  usedPins.add(accessPin);
  const documentId = createHash("sha256")
    .update(`hamkke-family-v1:${applicant.familyNo}:${accessPin}`)
    .digest("hex");
  return {
    update: {
      name: `${resourceRoot}/${collectionName}/${documentId}`,
      fields: fields({
        familyNo: applicant.familyNo,
        accessPin,
        ownerUid: "",
        applicantName: applicant.applicantName,
        authorizedNames: applicant.authorizedNames,
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
      }),
    },
    currentDocument: { exists: false },
  };
});

const response = await fetch(
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:batchWrite`,
  {
    method: "POST",
    headers: headersWithAuth,
    body: JSON.stringify({ writes }),
  },
);
if (!response.ok) {
  throw new Error(`명단 반영 실패: ${response.status} ${await response.text()}`);
}
const result = await response.json();
const failed = (result.status || []).filter((status) => status.code);
if (failed.length) {
  throw new Error(`명단 일부 반영 실패: ${JSON.stringify(failed)}`);
}

console.log(
  `${applicants.length}가정 명단 반영 완료 (기존 ${updated}가정 갱신, ${created}가정 추가)`,
);
