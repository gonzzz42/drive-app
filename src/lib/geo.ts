import type { LatLng } from "./courses";

// 완주 판정용 거리 계산.
// 좌표는 위도/경도(도). 거리는 미터.

const EARTH_RADIUS_M = 6371000;

// 판정 기준
export const START_RADIUS_M = 300; // 코스 시작점에서 300m 안에서 출발
export const END_RADIUS_M = 300; // 코스 끝점에서 300m 안에서 종료
export const ON_PATH_M = 50; // 코스 점이 주행 궤적 50m 안이면 "지나갔다"
export const MIN_OVERLAP = 0.85; // 코스 점의 85% 이상 지나가면 완주

export type Completion = {
  startOk: boolean; // 시작 300m 안
  endOk: boolean; // 끝 300m 안
  overlap: number; // 주행 궤적 50m 안에 들어온 코스 점의 비율 (0~1)
  completed: boolean; // 셋 다 만족하면 완주
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// 두 점 사이 거리 (하버사인)
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// 점 p에서 선분 a-b까지의 거리.
// 수십 km 범위에서는 위경도를 평면(미터)으로 펴서 계산해도 충분하다.
function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const cosLat = Math.cos(toRad(p.lat));
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerDegLng = mPerDegLat * cosLat;

  // p를 원점으로 두고 a, b를 미터 좌표로 바꾼다
  const ax = (a.lng - p.lng) * mPerDegLng;
  const ay = (a.lat - p.lat) * mPerDegLat;
  const bx = (b.lng - p.lng) * mPerDegLng;
  const by = (b.lat - p.lat) * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  // a와 b가 같은 점이면 점까지의 거리
  if (lenSq === 0) return Math.hypot(ax, ay);

  // 원점(p)을 선분 위에 내린 발의 위치 (0~1로 자름)
  let t = -(ax * dx + ay * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

// 점 p에서 궤적(path)까지의 최소 거리. path가 점 하나면 그 점까지의 거리.
export function distanceToPathMeters(p: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Infinity;
  if (path.length === 1) return distanceMeters(p, path[0]);
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegmentMeters(p, path[i], path[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

// 코스 polyline과 주행 궤적을 비교해 완주 여부를 판정한다.
export function judgeCompletion(course: LatLng[], trip: LatLng[]): Completion {
  if (course.length === 0 || trip.length === 0) {
    return { startOk: false, endOk: false, overlap: 0, completed: false };
  }

  const startOk =
    distanceMeters(trip[0], course[0]) <= START_RADIUS_M;
  const endOk =
    distanceMeters(trip[trip.length - 1], course[course.length - 1]) <= END_RADIUS_M;

  let hit = 0;
  for (const point of course) {
    if (distanceToPathMeters(point, trip) <= ON_PATH_M) hit++;
  }
  const overlap = hit / course.length;

  return {
    startOk,
    endOk,
    overlap,
    completed: startOk && endOk && overlap >= MIN_OVERLAP,
  };
}
