# Cursor / Claude Code에 그대로 붙여넣는 첫 명령

아래를 한 번에 하나씩만 실행한다.

---

## Prompt 1 — 프로젝트 생성

이 폴더에 Expo Router TypeScript 앱을 만들어라.
패키지: expo, expo-router, expo-location, expo-sharing, expo-file-system, expo-media-library, react-native-maps, @supabase/supabase-js.

화면 뼈대만:
- app/index.tsx 홈
- app/course/[id].tsx
- app/record/[id].tsx
- app/result/[tripId].tsx
- app/album.tsx

더미 코스 3개를 data/courses.json에 넣고 홈에서 리스트로 보여줘.
지금은 로그인 없이 로컬 JSON만 써도 된다.
한국어 UI. 실행 방법까지 적어줘.

---

## Prompt 2 — 코스 상세 + 외부 내비

코스 상세에 react-native-maps로 polyline을 그려라.
버튼 2개: 티맵으로 열기, 카카오로 열기.
URL이 없으면 Linking으로 검색어만 연다.
기록 시작 버튼은 /record/[id]로 이동.

---

## Prompt 3 — GPS 기록

/record/[id]에서 위치 권한을 받고 3초마다 좌표를 쌓아라.
화면에는 경과 시간, 포인트 수, 큰 종료 버튼만.
종료하면 path를 로컬에 저장하고 /result 로 간다.
백그라운드 위치는 아직 넣지 마라. 포그라운드만.

---

## Prompt 4 — 완주 판정

src/lib/geo.ts를 만들어라.
코스 polyline과 주행 path를 비교해
- 시작 300m
- 끝 300m
- 코스 포인트의 몇 %가 주행 궤적 50m 안에 있는지
계산하고 completed = overlap >= 0.85.

---

## Prompt 5 — 결과 카드

결과에 코스명, km, 분, 밤/낮, 완주 여부를 보여줘.
버튼: 이미지 저장, 공유.
이미지는 간단한 View를 캡처해도 되고, 일단 텍스트 카드 + 맵 스크린샷 수준이어도 된다.
사진 합성, 영상 편집, 캡션 생성기 만들지 마라.

---

## Prompt 6 — Supabase 연결

.env에 URL과 anon key를 읽고
익명 또는 이메일 로그인 후 trips를 저장하게 하라.
코스는 아직 JSON이어도 된다.
RLS가 있는 schema.sql 기준으로 코드를 맞춰라.
