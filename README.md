# 함께가정 사전·사후 진단

전남광주통합특별시 서구의 「생활 속 양성평등 함께 잇다」 사업용 웹앱입니다.

## 화면

- `/` 참여 가정: 가족 등록, 함께카드 100장, 성인별 함께지수, 주간 시간 기록, 사후 만족도
- `/admin` 관리자: 30가정 접속번호, 제출 현황, 가정별 세부 응답, 엑셀 내려받기

## 저장과 접근

- Firebase Authentication과 Cloud Firestore 사용
- 참여자는 가정 번호와 6자리 접속번호로 최초 기기를 연결
- 실제 Firestore 문서 주소는 가정 번호와 접속번호를 SHA-256으로 변환해 순번이 노출되지 않음
- 참여 가정은 자기 가정 자료만 읽고 수정 가능
- 관리자는 Firestore `admins/{uid}` 문서가 있는 Google 계정만 접근 가능
- 기존 여성안전지도 Firestore 규칙을 보존한 통합 규칙 사용

## 실행

```bash
npm install
npm run dev
```

운영 전 Firebase Authentication에서 Google과 익명 로그인을 활성화하고 `firebase deploy --only firestore:rules`를 실행합니다.
