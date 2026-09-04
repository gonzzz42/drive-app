import { Directory, File, Paths } from "expo-file-system";
import type { Course } from "./courses";
import { judgeCompletion, pathLengthMeters } from "./geo";
import { ensureSignedIn, supabase } from "./supabase";

// 주행 기록 하나. 폰 안의 문서 폴더에 trips/<id>.json 으로 저장한다.

export type TripPoint = {
  lat: number;
  lng: number;
  t: number; // 기록 시각 (epoch ms)
};

export type Trip = {
  id: string;
  courseId: string;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  points: TripPoint[];
  serverId?: string; // Supabase trips.id (서버에 저장됐으면 있음)
};

function tripsDir(): Directory {
  return new Directory(Paths.document, "trips");
}

export async function saveTrip(trip: Trip): Promise<void> {
  const dir = tripsDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const file = new File(dir, `${trip.id}.json`);
  file.write(JSON.stringify(trip));
}

// 없거나 읽기에 실패하면 undefined. 절대 던지지 않는다.
export async function loadTrip(id: string | undefined): Promise<Trip | undefined> {
  if (!id) return undefined;
  try {
    const file = new File(tripsDir(), `${id}.json`);
    if (!file.exists) return undefined;
    return JSON.parse(await file.text()) as Trip;
  } catch {
    return undefined;
  }
}

// 폰에 저장된 기록을 전부 읽는다. 최근 것이 앞.
// 파일 하나가 깨져 있어도 나머지는 살린다. 절대 던지지 않는다.
export async function listLocalTrips(): Promise<Trip[]> {
  const dir = tripsDir();
  if (!dir.exists) return [];

  let entries: (File | Directory)[] = [];
  try {
    entries = dir.list();
  } catch {
    return [];
  }

  const trips: Trip[] = [];
  for (const entry of entries) {
    if (!(entry instanceof File) || !entry.name.endsWith(".json")) continue;
    try {
      const trip = JSON.parse(await entry.text()) as Trip;
      if (typeof trip.id === "string" && Array.isArray(trip.points)) {
        trips.push(trip);
      }
    } catch {
      // 이 파일만 건너뛴다
    }
  }
  trips.sort((a, b) => b.startedAt - a.startedAt);
  return trips;
}

// 기록 좌표를 코스 선(polyline) 파일로 저장한다. 문서 폴더의 course-<id>-polyline.json.
// 앱은 data/courses.json을 고칠 수 없으므로, 이 파일을 컴퓨터로 보내 직접 붙여넣는다.
// 돌려주는 값은 파일 경로(uri).
export async function saveCoursePolylineFile(
  courseId: string,
  points: TripPoint[],
): Promise<string> {
  const polyline = points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const file = new File(Paths.document, `course-${courseId}-polyline.json`);
  file.write(JSON.stringify(polyline));
  return file.uri;
}

// 19시부터 새벽 6시 전까지는 밤
export function isNight(epochMs: number): boolean {
  const hour = new Date(epochMs).getHours();
  return hour >= 19 || hour < 6;
}

// 기록을 Supabase trips 테이블에 올린다. 성공하면 서버 id를 돌려준다.
// RLS 때문에 user_id는 반드시 로그인한 사용자여야 한다.
export async function uploadTrip(trip: Trip, course: Course | undefined): Promise<string> {
  if (!supabase) throw new Error("Supabase 설정이 없습니다 (.env 확인)");
  const userId = await ensureSignedIn();

  const result = course ? judgeCompletion(course.polyline, trip.points) : undefined;
  const row = {
    user_id: userId,
    course_id: course?.id ?? null,
    started_at: new Date(trip.startedAt).toISOString(),
    ended_at: new Date(trip.endedAt).toISOString(),
    distance_km: Math.round(pathLengthMeters(trip.points) / 100) / 10,
    duration_min: Math.round((trip.endedAt - trip.startedAt) / 60000),
    is_night: isNight(trip.startedAt),
    overlap_pct: result ? Math.round(result.overlap * 100) : null,
    completed: result?.completed ?? false,
    path: trip.points,
  };

  let { data, error } = await supabase.from("trips").insert(row).select("id").single();

  // 서버 courses 테이블에 이 코스가 없으면(외래키 오류 23503) 코스 없이 다시 저장
  if (error?.code === "23503" && row.course_id) {
    ({ data, error } = await supabase
      .from("trips")
      .insert({ ...row, course_id: null })
      .select("id")
      .single());
  }
  if (error || !data) throw error ?? new Error("서버 저장 실패");
  return data.id as string;
}
