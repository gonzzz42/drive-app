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
  polyline: LatLng[];
  is_official: boolean; // 앱이 고른 공식 코스인지
  featured?: boolean; // 추천 탭 메인 선반에 올릴지
  source_name?: string; // 원본 계정/글 이름 (없어도 됨)
  source_url?: string; // 원본 글 링크 (없어도 됨)
};

export const courses: Course[] = coursesJson as Course[];

export function getCourse(id: string | undefined): Course | undefined {
  if (!id) return undefined;
  return courses.find((c) => c.id === id);
}
