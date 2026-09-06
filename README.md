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

기록 로직 테스트(폰 없이, 라이브러리 추가 없이):

```bash
npm test
```

## Supabase 연결 (기록을 서버에 저장)

1. supabase.com에서 프로젝트를 만든다.
2. SQL Editor에 `supabase/schema.sql`을 붙여넣고 Run. 이어서 `supabase/seed_courses.sql`도 Run (코스 테이블 채우기).
3. Authentication → Sign In / Providers에서 **Allow anonymous sign-ins**를 켠다. 앱은 익명 로그인을 쓴다.
4. Project Settings → API의 Project URL과 anon public 키를 `.env`에 넣는다. `.env.example`을 복사해서 만들면 된다.

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

5. `.env`를 만들거나 바꾸면 `npx expo start`를 껐다가 다시 켠다.

결과 화면 아래에 "서버에 저장됨"이 뜨면 성공. Supabase 대시보드 Table Editor → trips에서 행을 볼 수 있다. `.env`가 없으면 "서버 미설정"이라고 뜨고 폰에만 저장된다.

## 코스 선(polyline)을 실제 주행으로 채우기

지금 `data/courses.json`의 polyline은 점 3개뿐이라 완주 판정이 거칠다. 실제로 한 번 타고 그 좌표를 넣으면 정확해진다.

1. 코스를 실제로 타면서 기록 시작 → 종료.
2. 결과 화면 아래 **"이 기록을 코스 선으로 저장"** 버튼(코스 선이 10개 미만일 때만 보임) → "공유"로 `course-<코스id>-polyline.json` 파일을 컴퓨터로 보낸다(카카오톡 나에게 보내기, 메일 등).
3. 그 파일 내용(`[{"lat":..,"lng":..}, ...]`)을 복사해 `data/courses.json`에서 해당 코스의 `"polyline"` 값에 붙여넣고 저장.
4. 앱을 새로고침하면 코스 상세의 선과 완주 판정에 바로 반영된다.

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

## 주행 기록 (백그라운드 수집)

드라이브 탭에서 **드라이브 시작**을 누르면 코스 없이도 기록이 시작된다. 기록 중에는 외부 내비로 가거나 화면을 꺼도 좌표가 이어진다.

- 개발 빌드(EAS development)에서만 백그라운드 수집이 된다. Android는 "드라이브 기록 중" 알림, iOS는 파란 위치 표시가 뜬다.
- Expo Go에서는 앱을 열어둔 동안만 기록된다 (기록 화면에 그렇게 표시된다).
- 기록 화면을 나가도 기록은 끝나지 않는다. 드라이브 탭의 **기록으로 돌아가기**로 돌아온다.
- 앱이 죽었다 켜지면 저장된 세션을 찾아 보여준다. 자동으로 다시 수집하지 않으며 **이어서 기록** 또는 **종료**를 고른다. 빠진 구간은 선을 잇지 않고 거리에서도 뺀다.
- 좌표는 문서 폴더 `recording/points.jsonl`에 받는 대로 덧붙여지고, 종료하면 `trips/<id>.json`으로 남는다.

구현 상태와 미검증 항목: `docs/stage1-status.md`

## 화면

- / 드라이브 (내 위치 지도 + 드라이브 시작 + 추천 코스)
- /browse 코스
- /history 내 기록
- /course/[id] 코스 상세 (이 코스 선택 / 출발점 길찾기)
- /record 기록 중 (진행 중인 세션)
- /record/[id] 코스 ID로 기록 시작 (옛 진입점, 같은 세션 로직)
- /result/[tripId] 결과 템플릿
