import type { LatLng } from "./courses";

// 거리 계산과 완주 판정.
// 좌표는 위도/경도(도). 거리는 미터.

const EARTH_RADIUS_M = 6371000;

// 판정 기준
export const START_RADIUS_M = 300; // 코스 시작점에서 300m 안에서 출발
export const END_RADIUS_M = 300; // 코스 끝점에서 300m 안에서 종료
export const ON_PATH_M = 50; // 코스 점이 주행 궤적 50m 안이면 "지나갔다"
export const MIN_OVERLAP = 0.85; // 코스 점의 85% 이상 지나가면 완주

// 좌표 사이 시간이 이보다 벌어지면 기록이 끊긴 것으로 본다 (터널·앱 중단·수집 실패).
// 끊긴 구간은 선으로 잇지 않고, 거리에도 넣지 않는다.
export const GAP_MS = 60_000;

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

// 궤적을 따라 이동한 총 거리 (점 사이 거리의 합). 끊김을 모르는 좌표 목록용.
export function pathLengthMeters(path: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += distanceMeters(path[i], path[i + 1]);
  }
  return total;
}

// 시각(t)이 있는 좌표를 끊긴 자리에서 나눈다. 좌표가 없으면 빈 배열.
// 시각 순서가 이미 맞다고 본다 (저장할 때 정렬한다).
export function splitSegments<P extends { t: number }>(points: P[], gapMs = GAP_MS): P[][] {
  const segments: P[][] = [];
  let current: P[] = [];
  for (const p of points) {
    const last = current[current.length - 1];
    if (last && p.t - last.t > gapMs) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// 구간별 거리의 합. 구간 사이(끊긴 자리)는 세지 않는다.
export function segmentsLengthMeters(segments: LatLng[][]): number {
  let total = 0;
  for (const seg of segments) total += pathLengthMeters(seg);
  return total;
}

// 기록 좌표의 실제 주행 거리: 끊긴 자리를 빼고 잰다.
export function tripDistanceMeters(points: (LatLng & { t: number })[]): number {
  return segmentsLengthMeters(splitSegments(points));
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

// 코스 polyline과 주행 궤적(끊긴 자리로 나눈 구간들)을 비교해 완주 여부를 판정한다.
// 끊긴 자리를 선으로 잇지 않으므로, 기록이 빠진 구간은 "지나갔다"로 치지 않는다.
export function judgeCompletion(course: LatLng[], segments: LatLng[][]): Completion {
  const nonEmpty = segments.filter((s) => s.length > 0);
  if (course.length === 0 || nonEmpty.length === 0) {
    return { startOk: false, endOk: false, overlap: 0, completed: false };
  }

  const first = nonEmpty[0][0];
  const lastSeg = nonEmpty[nonEmpty.length - 1];
  const last = lastSeg[lastSeg.length - 1];
  const startOk = distanceMeters(first, course[0]) <= START_RADIUS_M;
  const endOk = distanceMeters(last, course[course.length - 1]) <= END_RADIUS_M;

  let hit = 0;
  for (const point of course) {
    let min = Infinity;
    for (const seg of nonEmpty) {
      const d = distanceToPathMeters(point, seg);
      if (d < min) min = d;
    }
    if (min <= ON_PATH_M) hit++;
  }
  const overlap = hit / course.length;

  return {
    startOk,
    endOk,
    overlap,
    completed: startOk && endOk && overlap >= MIN_OVERLAP,
  };
}
