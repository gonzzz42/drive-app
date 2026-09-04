import coursesJson from "../../data/courses.json";

export type LatLng = { lat: number; lng: number };

export type Course = {
  id: string;
  name: string;
  region: string;
  tags: string[];
  distance_km: number;
  start_name: string;
  end_name: string;
  start_lat?: number;
  start_lng?: number;
  end_lat?: number;
  end_lng?: number;
  best_time: string;
  avoid_time: string;
  search_tmap: string;
  polyline: LatLng[]; // 도로를 따라가는 경로 점. scripts/fill-courses.js 가 채운다
  via?: LatLng[]; // 경로를 받을 때 반드시 지나갈 경유지 (관리자만 씀, 화면에 안 나옴)
  is_official: boolean; // 관리자가 확정해 배포한 코스만 true. false면 사용자 화면 어디에도 안 나온다
  featured?: boolean; // (예전 필드) 지금은 쓰지 않음
  source_name?: string; // 원본 계정/글 이름 (없어도 됨)
  source_url?: string; // 원본 글 링크 (없어도 됨)
};

// 파일에 있는 코스 전부 (미확정 포함). 기록에 남은 옛 코스 이름을 찾을 때만 쓴다.
const allCourses: Course[] = coursesJson as Course[];

// 사용자 화면에 나오는 코스: 관리자가 확정한 것만
export const courses: Course[] = allCourses.filter((c) => c.is_official);

export function getCourse(id: string | undefined): Course | undefined {
  if (!id) return undefined;
  return allCourses.find((c) => c.id === id);
}
