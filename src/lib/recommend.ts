import type { Course, LatLng } from "./courses";
import { distanceMeters } from "./geo";

// 홈 추천 순서.
// 1) 밤(19시~새벽 6시 전)이면 태그에 '밤'이 있는 코스를 위로
// 2) 그 안에서는 내 위치에서 가까운 순 (시작점 기준). 좌표 없는 코스는 뒤로.

// 아직 실제 위치를 안 쓰므로 더미 위치: 서울 강서구청
export const DUMMY_LOCATION: LatLng = { lat: 37.5509, lng: 126.8495 };

export function isNightHour(hour: number): boolean {
  return hour >= 19 || hour < 6;
}

function startDistance(course: Course, here: LatLng): number {
  if (course.start_lat == null || course.start_lng == null) return Infinity;
  return distanceMeters(here, { lat: course.start_lat, lng: course.start_lng });
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
