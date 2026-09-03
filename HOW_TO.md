# 처음부터: Claude Code vs Cursor

당신은 감독이다. 두 도구에 같은 일을 동시에 시키지 않는다.

## 누가 무엇을

| | Claude Code | Cursor |
|---|---|---|
| 언제 | 빈 폴더, 새 화면, GPS, DB 연결 | 이미 있는 화면 고치기, 글자, 버튼, 버그 |
| 어디서 | 터미널 | 에디터 채팅 + 파일 선택 |
| 위험 | 파일을 많이 만듦 | 한 파일을 잘 고침 |
| 하루 주인 | 새 기능 날 | 다듬는 날 |

규칙: 오늘은 둘 중 하나만 주인공.

## 0일차 준비

1. Node.js LTS, Git 설치
2. 이 `drive-app` 폴더를 내 컴퓨터로 복사
3. 폴더에서 터미널 연다

아직 `npx create-expo-app`을 직접 치지 않아도 된다. Claude Code가 C0에서 만든다.
이미 빈 Expo를 만들었다면 그 폴더에 CLAUDE.md, data, prompts를 복사한다.

## Claude Code 켜는 법

해당 폴더에서:

```bash
claude
```

첫 메시지에 `prompts/CLAUDE_CODE.md`의 **C0**만 붙여넣는다.
끝나면 폰에서 홈이 보이는지 확인한다. 보이면 Git 커밋.

그다음날 C1. 하루에 하나.

## Cursor 켜는 법

1. Cursor로 같은 폴더를 연다
2. `.cursor/rules/drive-app.mdc`가 있으면 규칙이 자동 적용된다
3. 고칠 파일 하나를 연다
4. 채팅에 `prompts/CURSOR.md`의 **K1** 같은 블록만 넣는다

에러가 나면 K5 + 빨간 로그 전체.

## 주차별 담당

- 0주 C0 : Claude Code
- 1주 C1, C5 : Claude Code / 다듬기 K1 : Cursor
- 2주 C2 : Claude Code / K2 : Cursor
- 3주 C3, C4 : Claude Code / K3 : Cursor
- 4주 C6 : Claude Code / K4 : Cursor

## 코스 데이터

코딩과 별개. 당신이 한다.

1. `data/course-inbox.csv`에 인스타 제목 적기
2. 직접 탄 코스만 `data/courses.json`으로 승격
3. polyline은 기록 기능이 된 뒤 그 주행으로 채움

## 금지

- “앱 전부 만들어줘”
- Claude와 Cursor에 같은 기능 동시
- 인스타 공유 예쁘게 만들기부터 시키기
- 카카오맵 SDK부터 붙이기
