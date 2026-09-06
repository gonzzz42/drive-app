# 1단계 구현 상태 — 현재 위치에서 자유 드라이브 시작 + 안정적인 주행 기록

기준 문서: `prompts/CLAUDE_CODE_PRODUCT_REBUILD.md` 4장. 작성일 2026-09-06.
다음 실행은 이 문서의 "미검증" 항목을 실기기에서 확인한 뒤 2단계(코스 약 10개)로 간다. 1단계를 다시 만들지 않는다.

## 실제 구현한 것

### 기록 유형 (4.1)
- `src/lib/tripModel.ts`: `Trip.kind: 'free' | 'course'`, `courseId: string | null`. 예전 기록(kind 없음)은 코스 주행으로 읽는다. 빈 courseId 는 '코스 정보 없음'이지 자유주행이 아니다. `tripKind()`, `tripTitle()`, `normalizeTrip()`.
- `src/lib/trips.ts`: 파일 읽기에 `normalizeTrip` 적용. 업로드는 서버에 없는 필드를 보내지 않고, 자유주행은 `course_id: null`, `completed: false`(호환값)로 올린다. 자유주행은 `judgeCompletion` 을 부르지 않는다.
- `src/lib/geo.ts`: `splitSegments()`(60초 넘게 비면 끊김), `segmentsLengthMeters()`, `tripDistanceMeters()`. `judgeCompletion(course, segments)` 는 끊긴 자리를 잇지 않는다.

### 기록 세션 (4.2)
- `src/lib/recordingCore.ts`: 순수 엔진. 활성 세션 하나, 시작 연타 방지, 세션 ID = 기록 ID, 좌표는 받는 대로 `points.jsonl` 에 덧붙임(append, 쓰는 주체는 엔진 하나), GPS 시각 사용, 늦게 온 것·중복·순서 뒤집힘 버림, 종료는 "종료 처리 중 → 수집 중단 확인 → 최종 저장 → 정리", 실패 시 같은 ID 로 재시도, 종료 처리 중·종료 후 좌표 무시.
- `src/lib/recording.ts`: 폰용 저장소(문서 폴더 `recording/session.json`, `recording/points.jsonl`)와 수집기 연결, `useRecording()` 훅.
- `app/record/index.tsx`: 진행 중 세션을 읽고 조작만 하는 화면. 거리·경과 시간·수집 상태·종료. 화면을 나가도 기록은 계속된다.
- `app/record/[id].tsx`: 옛 진입점. 공용 세션을 시작하고 `/record` 로 넘긴다 (기록 구현은 한 벌).

### 백그라운드 위치 (4.3)
- `expo-task-manager ~57.0.16` 추가 (`npx expo install`). `src/lib/locationTask.ts` 가 모듈 최상위에서 작업을 정의하고, 새 시작점 `index.ts` 가 라우터보다 먼저 불러온다 (`package.json` main).
- 수집기 우선순위: `startLocationUpdatesAsync`(Android foreground service 알림 "드라이브 기록 중", iOS 파란 위치 표시) → 안 켜지면 `watchPositionAsync` 포그라운드(화면에 "앱을 열어둔 동안만 기록됩니다"). 둘을 동시에 켜지 않는다.
- `app.json`: iOS `UIBackgroundModes: location` + Always/WhenInUse 문구, Android `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`. `ACCESS_BACKGROUND_LOCATION` 은 넣지 않았다 (사용자가 시작한 foreground service 는 두 플랫폼 모두 포그라운드 권한만 필요. expo-location 네이티브 코드 확인).
- 앱 재실행 시 `initRecording()` 이 수집기 상태만 확인한다. 자동으로 새 기록을 만들거나 수집을 다시 켜지 않는다. 기록 화면에서 **이어서 기록** 또는 **종료**.

### 홈과 진입 (4.4)
- 탭: 드라이브 / 코스 / 내 기록. 드라이브 탭 = 내 위치 지도(확인 중·권한 없음·확인됨 구분) → **드라이브 시작**(자유주행) / 선택한 코스가 있으면 **이 코스로 시작** + 코스 해제 / 진행 중이면 **기록으로 돌아가기** → 추천 코스 3개 + **코스 더 보기**.
- 코스 상세: **이 코스 선택**(드라이브 탭에 선택만 넣음) / **출발점 길찾기**. 선택만으로 기록을 시작하지 않는다.
- 결과·내 기록: 자유 드라이브는 '자유 드라이브'로, 완주/미완주 없이 표시. 실제 좌표만 그리고 끊긴 자리는 비운다 (`RouteSketch segments`).

## 자동 검사 결과 (2026-09-06)

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 통과 |
| `npm test` (node:test, 40개) | 통과 — 데이터 호환, 시작 연타·재진입 단일 세션, 종료 재시도 동일 ID, 늦은 콜백·중복·종료 후 좌표 무시, 저장 실패 복구, 중단 후 구간 분리, 기존 기록 회귀(끊김 없는 기록의 거리·판정 동일) |
| `npx expo export` Android / iOS | 번들 생성 성공 (백그라운드 동작 검증은 아님) |
| `npx expo config --type introspect` | UIBackgroundModes location, FOREGROUND_SERVICE(_LOCATION) 확인 |
| 금지 문구 grep (`app/`) | 비어 있음 |

## 폰 확인 (2026-09-06, 옛 개발 APK = 포그라운드 모드)

사용자가 Galaxy 개발 빌드(expo-task-manager 없는 APK)에서 확인해 "잘된다": 드라이브 탭(내 위치 지도·드라이브 시작·추천 코스) → 기록 화면("지금은 앱을 열어둔 동안만 기록됩니다") → 종료 → 결과 카드(자유 드라이브) → PNG 저장 완료. 이동 없이 제자리에서 확인한 것이라 거리·경로·내 기록 표시는 아직이다.

고친 것: ExpoTaskManager 네이티브 모듈이 없을 때 앱이 죽던 것(guarded require), 드라이브 탭 패널이 안 보이던 것(ScrollView 는 flex 비율이 안 먹어 지도 높이를 40%로 고정), 종료 때 react-native-screens 크래시(화면 안에서 헤더를 바꾸지 않고 루트 레이아웃에 고정).

## 실기기 미검증 (새 개발 빌드 필요)

`expo-task-manager` 와 권한 설정은 네이티브 변경이라 **새 EAS development 빌드**를 만들어야 한다 (`npx eas build -p android --profile development`). 기존 APK 로는 백그라운드 수집이 켜지지 않고 포그라운드로만 돈다.

- [ ] 코스 없이 시작 → 이동 → 종료 → 결과 → 내 기록
- [ ] 공식 코스 선택 → 이 코스로 시작 → 완주 판정 표시
- [ ] 기록 중 외부 내비로 전환·이동 후 복귀: 같은 세션, 실제 경로 남음
- [ ] 화면 잠근 채 이동 후 복귀: 기록 유지 (정지 상태 대기만으로 통과 처리하지 않음)
- [ ] 권한 거부·위치 서비스 꺼짐·수집 실패가 '기록 중'으로 숨겨지지 않음
- [ ] 종료 후 추가 수집·서비스 알림 중단
- [ ] 앱 강제 종료 후 재실행: 저장된 세션 복구, 빠진 구간이 끊김으로 표시
- [ ] 자유주행 결과 PNG 저장·공유, `.env` 없는 상태의 로컬 이용
- [ ] iOS 빌드 (Mac/EAS iOS 필요)

## 남긴 것 / 알아둘 것
- 네이티브 모듈이 없는 빌드(옛 개발 APK, Expo Go)에서는 `src/lib/taskManager.ts` 가 expo-task-manager 를 건너뛰어 앱이 죽지 않고 포그라운드 기록만 된다 (2026-09-06 폰에서 "Cannot find native module ExpoTaskManager" 오류를 보고 고침). 백그라운드 수집은 새 개발 빌드에서만.
- Expo Go: 백그라운드 수집 없음(포그라운드로만), Android 지도는 정적 그림.
- `saveCoursePolylineFile` 은 아직 쓰는 곳이 없다 (기존 유지).
- `ACCESS_BACKGROUND_LOCATION` 이 필요한 상황(앱을 완전히 끈 뒤에도 계속 수집)은 약속하지 않는다.
- 커밋하지 않았다. 폰에서 확인한 뒤 커밋한다.
