# 함께가정 사전·사후 진단

전남광주통합특별시 서구의 「생활 속 양성평등 함께 잇다」 사업용 웹앱입니다.

## 화면

- `/` 참여 가정: 가족 등록, 함께카드 100장, 성인별 함께지수, 주간 시간 기록, 사후 만족도
- `/admin` 관리자: 30가정 제출 현황, 가정별 세부 응답, 엑셀 내려받기

## 빠른 수정 위치

- 문구·설문 문항: `app/content.ts`
- 함께카드 100장: `app/cards.json`
- 참여 화면: `app/components/family/`
- 관리자 화면: `app/components/admin/`
- 색상·화면 모양: `app/globals.css`

## 저장과 접근

- Firebase Authentication과 Cloud Firestore 사용
- 데모 참여자는 가정 번호와 신청자 이름만 입력하면 접속 가능
- 관리자는 Firestore `admins/{uid}` 문서가 있는 Google 계정만 접근 가능
- 기존 여성안전지도 Firestore 규칙을 보존한 통합 규칙 사용

## 실행

```bash
npm install
npm run dev
```

운영 전 Firebase Authentication에서 Google과 익명 로그인을 활성화하고 `firebase deploy --only firestore:rules`를 실행합니다.
