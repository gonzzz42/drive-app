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

## 코드를 바꾼 뒤 폰에 반영하는 법

- 파일을 저장하면 보통 폰이 **자동으로** 바뀐다(Fast Refresh). 새로고침을 안 눌러도 된다.
- 새로고침이 필요하면 터미널에서 `r`을 한 번만 누른다. 터미널에 `Android Bundling ... %`가 올라가는 동안은 폰이 로딩 중인 게 정상이다. 처음 한 번은 30초~1분 걸릴 수 있다.
- 로딩 중에 새로고침을 또 누르면 처음부터 다시 만들기 때문에 더 오래 걸린다. 진행률이 100%가 될 때까지 기다린다.
- 1분 넘게 진행률이 안 움직이면 서버를 껐다가(Ctrl + C) 캐시를 지우고 다시 켠다.

```bash
npx expo start --clear
```

- 터미널에 아무 반응이 없는데 폰만 도는 경우는 폰이 컴퓨터를 못 찾는 것이다. Expo Go를 완전히 닫고(최근 앱에서 밀어서 종료) 다시 열어 QR을 찍는다. 그래도 안 되면 `npx expo start --tunnel`.

타입 검사만 하려면:

```bash
npm run typecheck
```

## Android에서 지도가 검게만 보일 때

Expo Go 안드로이드 앱에 들어 있는 구글 지도 키가 만료되어(Expo 이슈 #49323, 2026-08) Expo Go에서는 지도 타일이 안 그려진다. 코드 문제가 아니고 앱 설정으로도 못 고친다. 내 키를 넣은 **개발 빌드**를 만들면 된다.

1. Google Cloud Console에서 프로젝트 만들기 → "Maps SDK for Android" 사용 설정 → API 키 발급.
2. `app.json`의 `android` 안에 키 추가:

```json
"android": {
  "config": { "googleMaps": { "apiKey": "발급받은 키" } }
}
```

3. 개발 빌드 도구 설치 후 빌드. 컴퓨터에 Android Studio가 있으면 USB로 폰을 연결하고:

```bash
npx expo install expo-dev-client
npx expo run:android
```

Android Studio가 없으면 Expo 계정을 만들고 클라우드 빌드:

```bash
npx expo install expo-dev-client
npx eas-cli build --platform android --profile development
```

4. 빌드된 앱을 폰에 설치하면 그 뒤로는 Expo Go 대신 그 앱으로 `npx expo start`에 접속한다.

iPhone은 Apple 지도를 써서 Expo Go에서도 지도가 보인다.

## 화면

- / 지금 탈 만한 길
- /course/[id] 코스 상세
- /record/[id] 기록 중
- /result/[tripId] 결과 템플릿
- /album 도감
