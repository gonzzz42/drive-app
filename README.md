# 드라이브 코스 앱

예쁜 길을 찾고, 타고, 러닝앱처럼 결과 카드를 남긴다.

사용법의 본체는 HOW_TO.md
Claude Code 명령은 prompts/CLAUDE_CODE.md
Cursor 명령은 prompts/CURSOR.md

## 스택

Expo + TypeScript + expo-router + react-native-maps + expo-location + Supabase

## 실행 방법

1. 폰에 **Expo Go** 앱을 설치한다 (App Store / Play 스토어).
2. 이 폴더에서 터미널을 열고 한 번만 설치:

```bash
npm install
```

3. 개발 서버 시작:

```bash
npx expo start
```

4. 터미널에 QR 코드가 뜬다.
   - iPhone: 카메라 앱으로 QR을 찍는다.
   - Android: Expo Go 앱에서 QR을 찍는다.
5. 폰과 컴퓨터가 **같은 와이파이**에 있어야 한다. 안 되면 `npx expo start --tunnel`.

타입 검사만 하려면:

```bash
npm run typecheck
```

## 화면

- / 지금 탈 만한 길
- /course/[id] 코스 상세
- /record/[id] 기록 중
- /result/[tripId] 결과 템플릿
- /album 도감
