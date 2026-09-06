// 주행 기록의 모양과 기록 유형. 네이티브 모듈을 쓰지 않는 순수 코드라 테스트에서 바로 읽는다.
// 파일 저장·서버 업로드는 trips.ts 가 맡는다.

export type TripPoint = {
  lat: number;
  lng: number;
  t: number; // GPS 측정 시각 (epoch ms). 배달된 시각이 아니다.
};

// 기록 유형. 새 기록에는 반드시 있다.
//   free   자유주행 (courseId 는 null)
//   course 코스 주행 (courseId 는 코스 ID)
export type TripKind = "free" | "course";

export type Trip = {
  id: string;
  kind?: TripKind; // 예전 기록에는 없다 → 코스 주행으로 읽는다
  courseId: string | null; // 자유주행은 null. 예전 기록은 문자열(빈 문자열일 수 있음)
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  points: TripPoint[];
  serverId?: string; // Supabase trips.id (서버에 저장됐으면 있음)
};

// 화면에서 구분하는 세 가지.
//   free    자유 드라이브
//   course  코스 주행 (코스 ID 있음. 코스가 지금 없을 수도 있다)
//   unknown 코스 정보 없음 (예전 기록의 빈 코스 ID 등). 자유주행으로 바꿔 읽지 않는다.
export type TripKindView = "free" | "course" | "unknown";

export function tripKind(trip: Pick<Trip, "kind" | "courseId">): TripKindView {
  if (trip.kind === "free") return "free";
  const hasCourseId = typeof trip.courseId === "string" && trip.courseId.length > 0;
  return hasCourseId ? "course" : "unknown";
}

// 히스토리·결과 카드 제목. courseName 은 코스를 찾았을 때만 넘긴다.
export function tripTitle(trip: Pick<Trip, "kind" | "courseId">, courseName?: string): string {
  const kind = tripKind(trip);
  if (kind === "free") return "자유 드라이브";
  return courseName ?? "코스 정보 없음";
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// 좌표 하나를 검사한다. 모양이 아니면 undefined.
export function normalizePoint(raw: unknown): TripPoint | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;
  if (!isFiniteNumber(p.lat) || !isFiniteNumber(p.lng) || !isFiniteNumber(p.t)) return undefined;
  return { lat: p.lat, lng: p.lng, t: p.t };
}

// 파일에서 읽은 값을 Trip 으로 맞춘다. 예전 기록(kind 없음, courseId 문자열)도 그대로 살린다.
// 모양이 아니면 undefined. 절대 던지지 않는다.
export function normalizeTrip(raw: unknown): Trip | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return undefined;
  if (!isFiniteNumber(r.startedAt) || !isFiniteNumber(r.endedAt)) return undefined;
  if (!Array.isArray(r.points)) return undefined;

  const kind: TripKind | undefined = r.kind === "free" || r.kind === "course" ? r.kind : undefined;
  // 예전 기록: courseId 가 문자열이면 그대로(빈 문자열 포함). 없으면 null.
  const courseId = typeof r.courseId === "string" ? r.courseId : null;

  const trip: Trip = {
    id: r.id,
    courseId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    points: r.points.map(normalizePoint).filter((p): p is TripPoint => p != null),
  };
  if (kind) trip.kind = kind;
  if (typeof r.serverId === "string") trip.serverId = r.serverId;
  return trip;
}
