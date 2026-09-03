# Claude Code에 줄 일 (터미널, 새 기능)

한 번에 아래 블록 하나만 붙여넣는다. 번호 순서대로.

공통 머리말 (매 프롬프트 위에 붙여도 됨):

```
CLAUDE.md 규칙을 지켜라.
한국어 UI.
인스타 편집기, 내비, 속도 랭킹, 백그라운드 GPS, 카카오 네이티브 SDK 만들지 마라.
한 기능만 하고 멈춰라.
```

---

## C0. 프로젝트 생성

이 폴더를 Expo Router TypeScript 앱으로 만들어라.

설치: expo, expo-router, expo-location, expo-sharing, expo-file-system, expo-media-library, react-native-maps, @supabase/supabase-js

화면 뼈대만:
- app/index.tsx
- app/course/[id].tsx
- app/record/[id].tsx
- app/result/[tripId].tsx
- app/album.tsx

data/courses.json 의 코스를 홈 리스트로 보여줘.
로그인은 아직 없다.
실행 방법(npx expo start)을 적어라.

---

## C1. 코스 상세 + 외부 내비

코스 상세에 지도와 polyline.
버튼: 티맵으로 열기, 카카오로 열기, 기록 시작.
기록 시작은 /record/[id] 로 이동.
URL이 없으면 search_tmap 검색어로 Linking.

---

## C2. GPS 기록

/record/[id]
위치 권한 → 3초마다 좌표 저장.
화면: 경과 시간, 포인트 수, 큰 종료 버튼만.
종료 후 로컬 저장하고 /result 로.
백그라운드 위치 넣지 마라.

---

## C3. 완주 판정

src/lib/geo.ts
- 시작 300m
- 끝 300m
- 코스 포인트가 주행 궤적 50m 안에 있는 비율
overlap >= 0.85 이면 완주.

---

## C4. 결과 카드

결과 화면: 코스명, km, 분, 밤/낮, 완주 여부.
버튼: 이미지 저장, 공유.
View 캡처 수준이면 된다.
사진 합성·영상 편집·캡션 생성 금지.

---

## C5. 홈 추천

지금 시각이 19시 이후면 태그에 '밤'이 있는 코스를 위로.
가능하면 더미 위치는 서울 강서.

---

## C6. Supabase

.env의 URL, anon key.
이메일 또는 익명 로그인.
trips를 서버에 저장.
코스는 아직 JSON이어도 된다.
schema.sql RLS에 맞춰라.
