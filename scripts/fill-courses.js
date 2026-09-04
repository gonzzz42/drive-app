// 관리자용: data/courses.json의 확정 코스(is_official: true)에 실제 도로 경로와 거리를 채운다.
//
// 쓰는 법 (프로젝트 폴더에서, 앱 실행과 무관하게 컴퓨터에서만 돌린다)
//   node scripts/fill-courses.js            → 경로 점이 4개 미만인 확정 코스를 전부 채운다
//   node scripts/fill-courses.js <코스id>   → 그 코스만 (이미 채워져 있어도 다시)
//   node scripts/fill-courses.js --check    → 채우지 않고 점검만
//
// 코스마다 관리자가 정할 것: start_lat/start_lng, end_lat/end_lng, 필요하면 via(경유지 좌표 목록).
// 경로는 오픈스트리트맵 기반 공개 경로 서버(OSRM 데모)에서 받는다. 앱은 결과 파일만 쓰고 서버를 부르지 않는다.
// 데모 서버는 가벼운 사용만 허용하므로 코스를 한 번에 수십 개씩 돌리지 않는다.

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "courses.json");
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const MIN_POINTS = 4; // 이보다 적으면 "경로 없음"으로 본다 (앱도 같은 기준으로 점선을 그린다)

function hasCoords(c) {
  return (
    typeof c.start_lat === "number" &&
    typeof c.start_lng === "number" &&
    typeof c.end_lat === "number" &&
    typeof c.end_lng === "number"
  );
}

// 확정 코스가 배포 가능한 상태인지. 문제가 있으면 이유 목록을 돌려준다.
function problems(c) {
  const out = [];
  if (!hasCoords(c)) out.push("출발·도착 좌표 없음");
  if (!(c.distance_km > 0)) out.push("거리 0");
  if (!Array.isArray(c.polyline) || c.polyline.length < MIN_POINTS) out.push("경로 점 부족(4개 미만)");
  return out;
}

async function fetchRoute(c) {
  const pts = [
    { lat: c.start_lat, lng: c.start_lng },
    ...(Array.isArray(c.via) ? c.via : []),
    { lat: c.end_lat, lng: c.end_lng },
  ];
  const coords = pts.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { headers: { "User-Agent": "drive-app course filler (admin script)" } });
  const json = await res.json();
  if (json.code !== "Ok") throw new Error(`OSRM ${json.code}: ${json.message ?? ""}`);
  const route = json.routes[0];
  const polyline = route.geometry.coordinates.map(([lng, lat]) => ({
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
  }));
  const refs = new Set();
  for (const leg of route.legs) for (const s of leg.steps) if (s.ref) refs.add(s.ref);
  return { polyline, distanceKm: Math.round(route.distance / 100) / 10, minutes: Math.round(route.duration / 60), refs: [...refs] };
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const onlyId = args.find((a) => !a.startsWith("--"));
  const courses = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let changed = false;

  for (const c of courses) {
    const tag = `${c.id} (${c.name})`;
    if (!c.is_official) {
      console.log(`- 미확정, 사용자 화면에 안 나옴: ${tag}`);
      continue;
    }
    const wants = onlyId ? c.id === onlyId : (c.polyline?.length ?? 0) < MIN_POINTS;
    if (!checkOnly && wants) {
      if (!hasCoords(c)) {
        console.log(`! 좌표가 없어 못 채움: ${tag}`);
      } else {
        process.stdout.write(`… 경로 받는 중: ${tag} `);
        try {
          const r = await fetchRoute(c);
          c.polyline = r.polyline;
          c.distance_km = r.distanceKm;
          changed = true;
          console.log(`→ 점 ${r.polyline.length}개, ${r.distanceKm} km, 약 ${r.minutes}분, 도로 ${r.refs.join("/") || "정보 없음"}`);
        } catch (e) {
          console.log(`→ 실패: ${e.message}`);
        }
      }
    }
    const p = problems(c);
    console.log(p.length ? `! 확정인데 문제 있음: ${tag} → ${p.join(", ")}` : `✓ 배포 가능: ${tag}`);
  }

  if (changed) {
    fs.writeFileSync(FILE, JSON.stringify(courses, null, 2) + "\n");
    console.log(`저장함: ${path.relative(process.cwd(), FILE)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
