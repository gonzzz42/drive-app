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
  is_official: boolean;
};

export const courses: Course[] = coursesJson as Course[];

export function getCourse(id: string | undefined): Course | undefined {
  if (!id) return undefined;
  return courses.find((c) => c.id === id);
}
