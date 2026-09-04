import type { Course, LatLng } from "./courses";
import { distanceMeters } from "./geo";

// 홈 추천 순서.
// 1) 밤(19시~새벽 6시 전)이면 태그에 '밤'이 있는 코스를 위로
// 2) 그 안에서는 내 위치에서 가까운 순 (시작점 기준). 좌표 없는 코스는 뒤로.

// 위치를 아직 모를 때 쓰는 더미 위치: 서울 강서구청
export const DUMMY_LOCATION: LatLng = { lat: 37.5509, lng: 126.8495 };

// 왕복 시간 추정에 쓰는 평균 속도
const AVERAGE_SPEED_KMH = 40;
// 이보다 오래 걸리는 코스는 홈에서 뒤로 보낸다
export const LONG_TRIP_MIN = 90;

export function isNightHour(hour: number): boolean {
  return hour >= 19 || hour < 6;
}

// 홈에 보여줄 수 있는 코스: 시작 좌표와 거리가 있어야 시간을 셀 수 있다
export function hasHomeInfo(course: Course): boolean {
  return course.start_lat != null && course.start_lng != null && course.distance_km > 0;
}

function startDistance(course: Course, here: LatLng): number {
  if (course.start_lat == null || course.start_lng == null) return Infinity;
  return distanceMeters(here, { lat: course.start_lat, lng: course.start_lng });
}

// 왕복 분 추정: (내 위치→시작 + 코스 km + 끝→내 위치) / 40km/h * 60
// 끝 좌표가 없으면 코스 거리*2 + 시작까지*2 (왔던 길로 되돌아온다고 본다)
export function estimateRoundTripMinutes(course: Course, here: LatLng): number {
  const toStartKm = startDistance(course, here) / 1000;
  if (!Number.isFinite(toStartKm)) return Infinity;

  const end =
    course.end_lat != null && course.end_lng != null
      ? { lat: course.end_lat, lng: course.end_lng }
      : undefined;
  const totalKm = end
    ? toStartKm + course.distance_km + distanceMeters(end, here) / 1000
    : course.distance_km * 2 + toStartKm * 2;

  return Math.round((totalKm / AVERAGE_SPEED_KMH) * 60);
}

export function recommendCourses(
  courses: Course[],
  now: Date,
  here: LatLng = DUMMY_LOCATION,
): Course[] {
  const night = isNightHour(now.getHours());
  return [...courses].sort((a, b) => {
    if (night) {
      const aNight = a.tags.includes("밤") ? 0 : 1;
      const bNight = b.tags.includes("밤") ? 0 : 1;
      if (aNight !== bNight) return aNight - bNight;
    }
    return startDistance(a, here) - startDistance(b, here);
  });
}

// 홈 카드 목록: 조건에 맞는 코스만, 기존 추천 순서 유지, 90분 넘는 코스는 뒤로
export function homeCourses(
  courses: Course[],
  now: Date,
  here: LatLng = DUMMY_LOCATION,
): Course[] {
  const ordered = recommendCourses(courses.filter(hasHomeInfo), now, here);
  const near = ordered.filter((c) => estimateRoundTripMinutes(c, here) <= LONG_TRIP_MIN);
  const far = ordered.filter((c) => estimateRoundTripMinutes(c, here) > LONG_TRIP_MIN);
  return [...near, ...far];
}

// 오늘 길 1개: homeCourses 순서의 첫 코스.
// (시작 좌표·거리 있음 → 밤이면 '밤' 태그 우선 → 가까운 순 → 왕복 90분 이하 우선)
// 조건에 맞는 코스가 없으면 undefined.
export function pickTodayCourse(
  courses: Course[],
  now: Date,
  here: LatLng = DUMMY_LOCATION,
): Course | undefined {
  return homeCourses(courses, now, here)[0];
}

// 큰 카드의 한 줄 이유. best_time / avoid_time 을 짧게 보여주고, "지금 추천"이라고 단정하지 않는다.
export function reasonFor(course: Course): string {
  if (course.best_time) return `좋은 때: ${course.best_time}`;
  if (course.avoid_time) return `피할 때: ${course.avoid_time}`;
  return "시간 정보 없음";
}
