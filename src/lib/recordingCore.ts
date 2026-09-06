// 기록 세션의 핵심 규칙. 네이티브 모듈 없이 순수 코드로 두고, 저장소·위치 수집기는 밖에서 끼운다.
// (실제 폰용 연결은 recording.ts, 테스트는 recordingCore.test.ts)
//
// 지키는 규칙
// - 앱 전체에서 활성 세션은 하나. 시작 연타·재진입에도 두 번째 세션을 만들지 않는다.
// - 기록 ID 는 시작할 때 한 번 발급하고 종료·재시도·저장에서 그대로 쓴다.
// - 좌표는 받는 대로 순서대로 파일에 덧붙인다(append). 좌표 파일을 쓰는 주체는 이 엔진뿐이다.
// - 좌표 시각은 GPS 측정 시각. 늦게 온 것·중복·순서가 뒤집힌 것은 버린다.
// - 종료는 "종료 처리 중 → 수집 중단 확인 → 최종 저장 → 정리" 순서. 실패하면 같은 ID 로 다시 시도한다.
// - 종료 처리 중이거나 세션이 없으면 늦게 도착한 좌표를 버린다.

import { normalizePoint, type Trip, type TripKind, type TripPoint } from "./tripModel";

// TaskManager 작업 이름. 바꾸면 이미 등록된 폰에서 옛 작업이 남으니 바꾸지 않는다.
export const LOCATION_TASK = "drive-recording-location";

// 이 간격보다 촘촘한 좌표는 저장하지 않는다 (iOS 는 1초마다 보내기도 한다)
export const MIN_POINT_INTERVAL_MS = 2500;
// 마지막 좌표가 이보다 오래됐으면 "위치 신호 없음"으로 본다
export const STALE_AFTER_MS = 30_000;

export type CollectorKind = "background" | "foreground" | "none";
export type SessionStatus = "recording" | "stopping";

export type RecordingSession = {
  id: string; // 기록 ID. 종료 후 Trip.id 가 된다
  kind: TripKind;
  courseId: string | null;
  startedAt: number; // epoch ms
  status: SessionStatus;
  stoppedAt?: number; // 종료 버튼을 누른 시각. 재시도해도 같은 값
  collector: CollectorKind; // 실제로 켜진 수집기
};

// 저장소. 세션 파일과 좌표 파일(줄마다 JSON 하나)을 따로 둔다.
export type SessionStorage = {
  readSession(): string | null;
  writeSession(text: string): void;
  clearSession(): void;
  readPoints(): string;
  appendPoints(text: string): void;
  clearPoints(): void;
};

// 수집기 실패 이유. 화면에서 문구를 고르는 데 쓴다.
export type CollectorFailReason = "services" | "permission" | "collector";

export class CollectorError extends Error {
  reason: CollectorFailReason;
  constructor(reason: CollectorFailReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

// 위치 수집기. start 는 실제로 켜진 종류를 돌려주고, 못 켜면 CollectorError 를 던진다.
export type Collector = {
  start(onLocations: (points: TripPoint[]) => void): Promise<CollectorKind>;
  stop(): Promise<void>; // 멈춘 것을 확인하지 못하면 던진다
  isRunning(kind: CollectorKind): Promise<boolean>;
};

export type StartResult =
  | { ok: true; session: RecordingSession }
  | {
      ok: false;
      reason: "busy" | "active" | "storage" | CollectorFailReason;
      message: string;
    };

export type FinishResult =
  | { ok: true; tripId: string }
  | { ok: false; reason: "busy" | "none" | "storage" | "stop" | "save"; message: string };

export type ResumeResult =
  | { ok: true }
  | { ok: false; reason: "none" | "storage" | CollectorFailReason; message: string };

export type RecordingSnapshot = {
  session: RecordingSession | null;
  points: TripPoint[];
  collectorRunning: boolean;
  lastError: string | null; // 수집 중 생긴 오류 (권한 회수, 위치 서비스 꺼짐 등)
  finishError: string | null; // 마지막 종료 시도의 실패 이유
};

export type EngineDeps = {
  storage: SessionStorage;
  collector: Collector;
  saveTrip: (trip: Trip) => Promise<void>;
  now?: () => number;
  newId?: (now: number) => string;
};

// ---- 순수 함수 ----

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseSession(text: string | null | undefined): RecordingSession | null {
  if (!text) return null;
  try {
    const r = JSON.parse(text) as Record<string, unknown>;
    if (!r || typeof r !== "object") return null;
    if (typeof r.id !== "string" || r.id.length === 0) return null;
    if (r.kind !== "free" && r.kind !== "course") return null;
    if (!isFiniteNumber(r.startedAt)) return null;
    if (r.status !== "recording" && r.status !== "stopping") return null;
    const collector =
      r.collector === "background" || r.collector === "foreground" ? r.collector : "none";
    const session: RecordingSession = {
      id: r.id,
      kind: r.kind,
      courseId: typeof r.courseId === "string" && r.courseId.length > 0 ? r.courseId : null,
      startedAt: r.startedAt,
      status: r.status,
      collector,
    };
    if (isFiniteNumber(r.stoppedAt)) session.stoppedAt = r.stoppedAt;
    return session;
  } catch {
    return null;
  }
}

// 새로 받은 좌표 중 저장할 것만 고른다.
// - 모양이 아닌 것, 시작 전 시각, 이미 저장한 시각(lastT) 이전은 버린다
// - 시각순으로 정렬하고, 같은 시각·너무 촘촘한 것은 버린다
export function acceptPoints(
  incoming: TripPoint[],
  lastT: number,
  startedAt: number,
  minIntervalMs = MIN_POINT_INTERVAL_MS,
): TripPoint[] {
  const valid = incoming
    .map(normalizePoint)
    .filter((p): p is TripPoint => p != null && p.t >= startedAt)
    .sort((a, b) => a.t - b.t);
  const out: TripPoint[] = [];
  let last = lastT;
  for (const p of valid) {
    if (p.t - last < minIntervalMs) continue;
    out.push(p);
    last = p.t;
  }
  return out;
}

// 줄마다 JSON 하나. 덧붙이기(append)만 하므로 앞부분은 절대 다시 쓰지 않는다.
export function encodePoints(points: TripPoint[]): string {
  return points.map((p) => JSON.stringify({ lat: p.lat, lng: p.lng, t: p.t })).join("\n") + "\n";
}

// 깨진 줄(쓰다 만 마지막 줄 등)은 건너뛴다. 시각순 정렬, 같은 시각은 하나만.
export function decodePoints(text: string): TripPoint[] {
  const out: TripPoint[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const p = normalizePoint(JSON.parse(trimmed));
      if (p) out.push(p);
    } catch {
      // 이 줄만 버린다
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out.filter((p, i) => i === 0 || p.t !== out[i - 1].t);
}

export type CollectorStatus = "stopped" | "waiting" | "ok" | "stale";

// 화면의 "위치 수집 상태" 한 줄을 고르는 규칙
export function collectorStatus(
  running: boolean,
  lastPointT: number | undefined,
  now: number,
): CollectorStatus {
  if (!running) return "stopped";
  if (lastPointT == null) return "waiting";
  return now - lastPointT > STALE_AFTER_MS ? "stale" : "ok";
}

// ---- 엔진 ----

export class RecordingEngine {
  private deps: Required<EngineDeps>;
  private session: RecordingSession | null = null;
  private points: TripPoint[] = [];
  private lastT = -Infinity;
  private collectorRunning = false;
  private lastError: string | null = null;
  private finishError: string | null = null;
  private starting = false;
  private finishing = false;
  private loaded = false;
  private listeners = new Set<() => void>();

  constructor(deps: EngineDeps) {
    this.deps = {
      now: () => Date.now(),
      newId: (now) => String(now),
      ...deps,
    };
  }

  // ---- 읽기 ----

  // 저장소에서 세션과 좌표를 읽는다. JS 컨텍스트마다 한 번 (앱 재시작·헤드리스 실행 포함).
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.reloadSession();
    if (this.session) this.reloadPoints();
  }

  // 세션 파일을 다시 읽는다. 다른 실행 컨텍스트가 종료했을 수 있어 좌표를 받을 때마다 확인한다.
  // 읽기에 실패하면 메모리에 있는 값을 그대로 쓴다.
  private reloadSession(): RecordingSession | null {
    try {
      this.session = parseSession(this.deps.storage.readSession());
    } catch {
      // 읽기 실패: 메모리 값 유지
    }
    return this.session;
  }

  // 좌표 파일을 다시 읽는다 (화면 복귀 시, 종료 직전). 파일이 기준이다.
  reloadPoints(): void {
    try {
      this.points = this.session ? decodePoints(this.deps.storage.readPoints()) : [];
    } catch {
      this.points = [];
    }
    const last = this.points[this.points.length - 1];
    this.lastT = last ? last.t : -Infinity;
    this.emit();
  }

  getSnapshot(): RecordingSnapshot {
    this.load();
    return {
      session: this.session,
      points: this.points,
      collectorRunning: this.collectorRunning,
      lastError: this.lastError,
      finishError: this.finishError,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  // 수집기가 실제로 돌고 있는지 확인한다 (앱 재시작 후 복구 판단용).
  async refreshCollector(): Promise<boolean> {
    this.load();
    let running = false;
    if (this.session && this.session.status === "recording") {
      try {
        running = await this.deps.collector.isRunning(this.session.collector);
      } catch {
        running = false;
      }
    }
    this.collectorRunning = running;
    this.emit();
    return running;
  }

  // ---- 시작 ----

  async start(courseId: string | null): Promise<StartResult> {
    if (this.starting) return { ok: false, reason: "busy", message: "기록을 시작하는 중입니다." };
    this.starting = true;
    try {
      this.load();
      if (this.reloadSession()) {
        return { ok: false, reason: "active", message: "이미 진행 중인 기록이 있습니다." };
      }
      const now = this.deps.now();
      const session: RecordingSession = {
        id: this.deps.newId(now),
        kind: courseId ? "course" : "free",
        courseId: courseId ?? null,
        startedAt: now,
        status: "recording",
        collector: "none",
      };
      try {
        this.deps.storage.clearPoints();
        this.deps.storage.writeSession(JSON.stringify(session));
      } catch {
        return { ok: false, reason: "storage", message: "기록 파일을 만들지 못했습니다." };
      }
      this.session = session;
      this.points = [];
      this.lastT = -Infinity;
      this.lastError = null;
      this.finishError = null;
      this.emit();

      let kind: CollectorKind;
      try {
        kind = await this.deps.collector.start((pts) => this.handleLocations(pts));
      } catch (e) {
        // 수집을 못 켰으면 세션을 남기지 않는다. 실패를 '기록 중'으로 보이게 하지 않는다.
        try {
          this.deps.storage.clearSession();
          this.deps.storage.clearPoints();
        } catch {
          // 정리 실패는 무시 (다음 시작에서 덮어쓴다)
        }
        this.session = null;
        this.points = [];
        this.collectorRunning = false;
        this.emit();
        const reason = e instanceof CollectorError ? e.reason : "collector";
        const message =
          e instanceof Error && e.message ? e.message : "위치 수집을 시작하지 못했습니다.";
        return { ok: false, reason, message };
      }

      const started: RecordingSession = { ...session, collector: kind };
      try {
        this.deps.storage.writeSession(JSON.stringify(started));
      } catch {
        // 수집기 종류만 못 적은 것. 기록은 계속된다
      }
      this.session = started;
      this.collectorRunning = true;
      this.emit();
      return { ok: true, session: started };
    } finally {
      this.starting = false;
    }
  }

  // ---- 좌표 수신 (포그라운드 watcher 와 백그라운드 작업이 둘 다 여기로 온다) ----

  // 저장한 좌표 수를 돌려준다. 세션이 없거나 종료 처리 중이면 0.
  handleLocations(incoming: TripPoint[]): number {
    this.load();
    const session = this.reloadSession();
    if (!session || session.status !== "recording") return 0;
    const accepted = acceptPoints(incoming, this.lastT, session.startedAt);
    if (accepted.length === 0) return 0;
    try {
      this.deps.storage.appendPoints(encodePoints(accepted));
    } catch {
      this.lastError = "좌표를 저장하지 못했습니다.";
      this.emit();
      return 0;
    }
    this.points = this.points.concat(accepted);
    this.lastT = accepted[accepted.length - 1].t;
    this.lastError = null;
    this.emit();
    return accepted.length;
  }

  // 수집기가 오류를 알렸을 때 (권한 회수, 위치 서비스 꺼짐 등)
  noteError(message: string): void {
    this.lastError = message;
    this.emit();
  }

  // ---- 종료 ----

  async finish(): Promise<FinishResult> {
    if (this.finishing) return { ok: false, reason: "busy", message: "종료 처리 중입니다." };
    this.finishing = true;
    try {
      this.load();
      const current = this.reloadSession();
      if (!current) return { ok: false, reason: "none", message: "진행 중인 기록이 없습니다." };

      // 1) 종료 처리 중으로 표시. 이 뒤로 도착하는 좌표는 버린다. 재시도해도 stoppedAt 은 그대로.
      let session = current;
      if (session.status === "recording") {
        session = { ...session, status: "stopping", stoppedAt: this.deps.now() };
        try {
          this.deps.storage.writeSession(JSON.stringify(session));
        } catch {
          return this.failFinish("storage", "기록 상태를 저장하지 못했습니다. 다시 시도해 주세요.");
        }
        this.session = session;
        this.emit();
      }

      // 2) 수집 중단 확인
      try {
        await this.deps.collector.stop();
      } catch {
        return this.failFinish("stop", "위치 수집을 멈추지 못했습니다. 다시 시도해 주세요.");
      }
      this.collectorRunning = false;

      // 3) 최종 로컬 저장. 파일에 있는 좌표가 기준이다.
      this.reloadPoints();
      const trip: Trip = {
        id: session.id,
        kind: session.kind,
        courseId: session.kind === "free" ? null : session.courseId,
        startedAt: session.startedAt,
        endedAt: session.stoppedAt ?? this.deps.now(),
        points: this.points,
      };
      try {
        await this.deps.saveTrip(trip);
      } catch {
        return this.failFinish("save", "기록을 저장하지 못했습니다. 다시 시도해 주세요.");
      }

      // 4) 세션 정리. 실패하면 같은 ID 로 다시 시도한다 (저장은 이미 됐다).
      try {
        this.deps.storage.clearSession();
        this.deps.storage.clearPoints();
      } catch {
        return this.failFinish("storage", "기록 파일을 정리하지 못했습니다. 다시 시도해 주세요.");
      }
      this.session = null;
      this.points = [];
      this.lastT = -Infinity;
      this.finishError = null;
      this.emit();
      return { ok: true, tripId: trip.id };
    } finally {
      this.finishing = false;
    }
  }

  private failFinish(
    reason: "storage" | "stop" | "save",
    message: string,
  ): FinishResult {
    this.finishError = message;
    this.emit();
    return { ok: false, reason, message };
  }

  // ---- 복구: 세션은 있는데 수집기가 멈춰 있을 때 (앱 강제 종료 후 재실행 등) ----

  async resume(): Promise<ResumeResult> {
    this.load();
    const session = this.reloadSession();
    if (!session || session.status !== "recording") {
      return { ok: false, reason: "none", message: "이어서 기록할 세션이 없습니다." };
    }
    try {
      if (await this.deps.collector.isRunning(session.collector)) {
        this.collectorRunning = true;
        this.emit();
        return { ok: true };
      }
    } catch {
      // 확인 실패: 새로 켠다
    }
    this.reloadPoints();
    let kind: CollectorKind;
    try {
      kind = await this.deps.collector.start((pts) => this.handleLocations(pts));
    } catch (e) {
      const reason = e instanceof CollectorError ? e.reason : "collector";
      const message =
        e instanceof Error && e.message ? e.message : "위치 수집을 다시 시작하지 못했습니다.";
      this.lastError = message;
      this.collectorRunning = false;
      this.emit();
      return { ok: false, reason, message };
    }
    const resumed: RecordingSession = { ...session, collector: kind };
    try {
      this.deps.storage.writeSession(JSON.stringify(resumed));
    } catch {
      // 종류만 못 적은 것
    }
    this.session = resumed;
    this.collectorRunning = true;
    this.lastError = null;
    this.emit();
    return { ok: true };
  }
}
