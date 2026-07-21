# Firebase 연결 안내

## 필요한 Firebase 기능

- Cloud Firestore
- Firebase Authentication의 Google 로그인
- 웹 앱 1개

사진을 받지 않으므로 Firebase Storage는 사용하지 않습니다.

## 설정 순서

1. Firebase Console에서 새 프로젝트를 만듭니다.
2. Cloud Firestore 데이터베이스를 프로덕션 모드로 만듭니다.
3. Authentication에서 Google 로그인을 사용 설정합니다.
4. 프로젝트에 웹 앱을 추가합니다.
5. 표시되는 `firebaseConfig` 값을 `firebase-config.js`에 입력합니다.
6. `firestore.rules`의 내용을 Firestore 규칙 화면에 붙여넣고 게시합니다.
7. 관리자 앱에서 Google 로그인을 한 번 시도합니다.
8. 화면에 표시되는 UID를 문서 ID로 사용하여 `admins` 컬렉션에 문서를 만듭니다.
9. 해당 문서에 불리언 필드 `active`를 `true`로 저장합니다.

## 관리자 문서 예시

- 컬렉션: `admins`
- 문서 ID: 관리자 로그인 화면에 표시되는 UID
- 필드: `active` / boolean / `true`

## Firestore 자료 구조

- `reports`: 시민참여단이 등록한 취약 위치와 의견
- `admins`: 관리자 권한이 있는 Firebase Authentication 사용자

시민참여단 앱은 의견 등록만 가능하고, 기존 의견을 읽거나 수정할 수 없습니다. 관리자만 로그인 후 전체 의견을 읽고 처리상태를 변경할 수 있습니다.
