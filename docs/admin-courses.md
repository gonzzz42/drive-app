# 추천 코스 관리 (관리자용)

추천 코스는 앱이 계산하지 않는다. 관리자가 `data/courses.json`에 정해서 배포한다.
사용자 화면(시작·추천·상세)에는 **`is_official: true`인 코스만** 나온다. 나머지는 파일에 있어도 보이지 않는다.

## 코스 하나 추가하는 순서

1. `data/courses.json`에 코스를 하나 추가한다. 관리자가 직접 적는 값은 이것뿐이다.

```json
{
  "id": "jayu-ro-haengju-imjingak",
  "name": "자유로 행주 → 임진각",
  "region": "경기 파주",
  "tags": ["강변", "밤"],
  "start_name": "행주대교 북단",
  "end_name": "임진각",
  "start_lat": 37.599,
  "start_lng": 126.81,
  "end_lat": 37.889,
  "end_lng": 126.74,
  "via": [],
  "distance_km": 0,
  "polyline": [],
  "best_time": "",
  "avoid_time": "",
  "search_tmap": "임진각",
  "is_official": false,
  "source_name": "",
  "source_url": ""
}
```

   - 좌표 얻는 법: 구글 지도 웹에서 그 지점을 길게 누르면 위도, 경도가 뜬다. 앞이 `lat`, 뒤가 `lng`.
   - `via`: 경로가 엉뚱한 길로 가면 반드시 지나갈 지점을 순서대로 넣는다. 보통 비워 둔다.
   - `distance_km`, `polyline`은 비워 둔다. 스크립트가 채운다.
   - `is_official`은 확인 전까지 `false`.

2. 경로와 거리를 채운다. 컴퓨터에서 한 번만 돌린다.

```
node scripts/fill-courses.js <코스id>
```

   실제 도로를 따라가는 좌표(보통 수백 개)와 도로 거리가 파일에 들어간다.

3. 앱에서 확인한다. 상세 화면 지도에 선이 의도한 도로를 타는지 본다. 아니면 `via`를 넣고 2번을 다시 한다.

4. 확정한다. `is_official`을 `true`로 바꾸고 점검한다.

```
node scripts/fill-courses.js --check
```

   `✓ 배포 가능`이 나와야 한다. `!`가 있으면 그 이유를 고친다.

5. 커밋한다.

## 규칙

- `is_official: true`인데 좌표·거리·경로가 빈 코스가 사용자에게 나가면 안 된다. `--check`가 잡아 준다.
- 코스 이름은 실제 장소·도로 이름만 쓴다. 수식어를 붙이지 않는다.
- `best_time`, `avoid_time`, `region`, `tags`는 화면에 나오지 않는다. 비워 둬도 된다.
- 경로 서버(OSRM 데모)는 가벼운 사용만 허용한다. 코스를 한 번에 수십 개씩 돌리지 않는다.
