import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitSegments, GAP_MS } from "./geo";
import {
  acceptPoints,
  CollectorError,
  collectorStatus,
  decodePoints,
  encodePoints,
  MIN_POINT_INTERVAL_MS,
  parseSession,
  RecordingEngine,
  type Collector,
  type CollectorKind,
  type SessionStorage,
} from "./recordingCore";
import type { Trip, TripPoint } from "./tripModel";

// 기록 세션 엔진. 저장소와 수집기를 가짜로 끼워 규칙만 확인한다.

// ---- 가짜 저장소: 메모리. 필요하면 실패를 흉내 낸다 ----
function memoryStorage() {
  const box = {
    session: null as string | null,
    points: "",
    failAppend: false,
    failWriteSession: false,
    failClear: false,
  };
  const storage: SessionStorage = {
    readSession: () => box.session,
    writeSession: (text) => {
      if (box.failWriteSession) throw new Error("write fail");
      box.session = text;
    },
    clearSession: () => {
      if (box.failClear) throw new Error("clear fail");
      box.session = null;
    },
    readPoints: () => box.points,
    appendPoints: (text) => {
      if (box.failAppend) throw new Error("append fail");
      box.points += text;
    },
    clearPoints: () => {
      if (box.failClear) throw new Error("clear fail");
      box.points = "";
    },
  };
  return { box, storage };
}

// ---- 가짜 수집기 ----
function fakeCollector(opts: { kind?: CollectorKind; failStart?: Error } = {}) {
  const state = {
    running: false,
    startCalls: 0,
    stopCalls: 0,
    failStop: false,
    onLocations: undefined as ((pts: TripPoint[]) => void) | undefined,
  };
  const collector: Collector = {
    async start(onLocations) {
      state.startCalls++;
      if (opts.failStart) throw opts.failStart;
      state.onLocations = onLocations;
      state.running = true;
      return opts.kind ?? "background";
    },
    async stop() {
      state.stopCalls++;
      if (state.failStop) throw new Error("stop fail");
      state.running = false;
      state.onLocations = undefined;
    },
    async isRunning() {
      return state.running;
    },
  };
  // 수집기가 좌표를 넘기는 흉내
  const push = (pts: TripPoint[]) => state.onLocations?.(pts);
  return { state, collector, push };
}

function makeEngine(
  storage: SessionStorage,
  collector: Collector,
  opts: { saveTrip?: (t: Trip) => Promise<void>; now?: () => number } = {},
) {
  const saved: Trip[] = [];
  const engine = new RecordingEngine({
    storage,
    collector,
    saveTrip:
      opts.saveTrip ??
      (async (t) => {
        saved.push(t);
      }),
    now: opts.now ?? (() => 1_000_000),
  });
  return { engine, saved };
}

// 시작 시각 T0 부터 3초 간격 n개
const T0 = 1_000_000;
function pts(n: number, from = T0 + 1000, step = 3000, lat = 37.5): TripPoint[] {
  return Array.from({ length: n }, (_, i) => ({ lat: lat + i * 0.001, lng: 127, t: from + i * step }));
}

describe("acceptPoints", () => {
  it("시각순 정렬, 시작 전·중복·너무 촘촘한 것은 버린다", () => {
    const startedAt = 1000;
    const incoming: TripPoint[] = [
      { lat: 1, lng: 1, t: 7000 }, // 순서 뒤집힘
      { lat: 1, lng: 1, t: 4000 },
      { lat: 1, lng: 1, t: 4000 }, // 중복
      { lat: 1, lng: 1, t: 500 }, // 시작 전
      { lat: 1, lng: 1, t: 5000 }, // 4000 에서 1초 뒤: 너무 촘촘
      { lat: NaN, lng: 1, t: 9000 }, // 깨진 좌표
    ];
    const out = acceptPoints(incoming, -Infinity, startedAt);
    assert.deepEqual(
      out.map((p) => p.t),
      [4000, 7000],
    );
  });

  it("이미 저장한 시각(lastT) 이전은 버린다 (늦게 배달된 콜백)", () => {
    const out = acceptPoints([{ lat: 1, lng: 1, t: 3000 }, { lat: 1, lng: 1, t: 10_000 }], 5000, 0);
    assert.deepEqual(
      out.map((p) => p.t),
      [10_000],
    );
  });

  it("간격은 MIN_POINT_INTERVAL_MS 기준", () => {
    const a = { lat: 1, lng: 1, t: 0 };
    const b = { lat: 1, lng: 1, t: MIN_POINT_INTERVAL_MS };
    assert.equal(acceptPoints([a, b], -Infinity, 0).length, 2);
    assert.equal(acceptPoints([a, { ...b, t: MIN_POINT_INTERVAL_MS - 1 }], -Infinity, 0).length, 1);
  });
});

describe("좌표 파일", () => {
  it("encode → decode 왕복", () => {
    const p = pts(3);
    assert.deepEqual(decodePoints(encodePoints(p)), p);
  });

  it("쓰다 만 마지막 줄·빈 줄은 건너뛰고, 순서를 맞추고, 같은 시각은 하나만", () => {
    const text = encodePoints([pts(1)[0]]) + '{"lat":37.6,"lng":127,"t":' + "\n\n" + encodePoints(pts(2, T0 + 1000)); // 두 번째 덩어리는 첫 점과 시각이 겹친다
    const out = decodePoints(text);
    assert.equal(out.length, 2);
    assert.ok(out[0].t < out[1].t);
  });

  it("parseSession 은 모양이 아니면 null", () => {
    assert.equal(parseSession(null), null);
    assert.equal(parseSession("{"), null);
    assert.equal(parseSession(JSON.stringify({ id: "a" })), null);
    const s = parseSession(
      JSON.stringify({ id: "a", kind: "free", courseId: null, startedAt: 1, status: "recording", collector: "weird" }),
    );
    assert.ok(s);
    assert.equal(s.collector, "none");
  });
});

describe("collectorStatus", () => {
  it("멈춤 / 대기 / 정상 / 신호 없음", () => {
    assert.equal(collectorStatus(false, 100, 200), "stopped");
    assert.equal(collectorStatus(true, undefined, 200), "waiting");
    assert.equal(collectorStatus(true, 100, 200), "ok");
    assert.equal(collectorStatus(true, 100, 100 + 31_000), "stale");
  });
});

describe("RecordingEngine 시작", () => {
  it("자유주행은 kind free · courseId null, 코스 주행은 kind course", async () => {
    const { storage, box } = memoryStorage();
    const { engine } = makeEngine(storage, fakeCollector().collector);
    const r = await engine.start(null);
    assert.ok(r.ok);
    assert.equal(r.session.kind, "free");
    assert.equal(r.session.courseId, null);
    assert.equal(r.session.collector, "background");
    assert.equal(parseSession(box.session)?.id, r.session.id);

    const { storage: s2 } = memoryStorage();
    const { engine: e2 } = makeEngine(s2, fakeCollector().collector);
    const r2 = await e2.start("jayu-ro-haengju-imjingak");
    assert.ok(r2.ok);
    assert.equal(r2.session.kind, "course");
    assert.equal(r2.session.courseId, "jayu-ro-haengju-imjingak");
  });

  it("시작 연타: 세션 하나, 수집기 한 번", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    const [a, b, c] = await Promise.all([engine.start(null), engine.start(null), engine.start(null)]);
    const oks = [a, b, c].filter((r) => r.ok);
    assert.equal(oks.length, 1);
    assert.ok([a, b, c].filter((r) => !r.ok).every((r) => !r.ok && (r.reason === "busy" || r.reason === "active")));
    assert.equal(fc.state.startCalls, 1);
    assert.ok(box.session);
    // 순서대로 다시 눌러도 같은 세션
    const again = await engine.start(null);
    assert.ok(!again.ok && again.reason === "active");
    assert.equal(fc.state.startCalls, 1);
  });

  it("재진입(새 컨텍스트)에서도 같은 세션을 읽고 새로 만들지 않는다", async () => {
    const { storage } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    const r = await engine.start(null);
    assert.ok(r.ok);
    fc.push(pts(2));

    const { engine: e2 } = makeEngine(storage, fc.collector);
    const snap = e2.getSnapshot();
    assert.equal(snap.session?.id, r.session.id);
    assert.equal(snap.points.length, 2);
    const again = await e2.start(null);
    assert.ok(!again.ok && again.reason === "active");
  });

  it("권한 실패 등 수집기를 못 켜면 세션을 남기지 않는다", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector({ failStart: new CollectorError("permission", "권한 없음") });
    const { engine } = makeEngine(storage, fc.collector);
    const r = await engine.start(null);
    assert.ok(!r.ok && r.reason === "permission");
    assert.equal(box.session, null);
    assert.equal(engine.getSnapshot().session, null);
    assert.equal(engine.getSnapshot().collectorRunning, false);
  });
});

describe("RecordingEngine 좌표", () => {
  it("받은 배치를 순서대로 파일에 덧붙이고, 늦게 온 것·중복은 버린다", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    await engine.start(null);
    assert.equal(engine.handleLocations(pts(3)), 3);
    // 늦게 배달된 옛 좌표 + 이미 있는 시각 + 새 좌표 하나
    const late: TripPoint[] = [
      { lat: 1, lng: 1, t: T0 + 1000 }, // 이미 저장한 첫 점 시각
      { lat: 1, lng: 1, t: T0 + 2000 }, // lastT 이전
      { lat: 1, lng: 1, t: T0 + 1000 + 3 * 3000 }, // 새 점
    ];
    assert.equal(engine.handleLocations(late), 1);
    const onDisk = decodePoints(box.points);
    assert.equal(onDisk.length, 4);
    assert.deepEqual(onDisk, engine.getSnapshot().points);
    assert.ok(onDisk.every((p, i) => i === 0 || p.t > onDisk[i - 1].t));
  });

  it("세션이 없으면 아무것도 저장하지 않는다", () => {
    const { storage, box } = memoryStorage();
    const { engine } = makeEngine(storage, fakeCollector().collector);
    assert.equal(engine.handleLocations(pts(3)), 0);
    assert.equal(box.points, "");
  });

  it("좌표 저장 실패는 오류로 남기고, 다음 저장부터 다시 이어진다", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    await engine.start(null);
    box.failAppend = true;
    assert.equal(engine.handleLocations(pts(1)), 0);
    assert.ok(engine.getSnapshot().lastError);
    box.failAppend = false;
    assert.equal(engine.handleLocations(pts(2, T0 + 10_000)), 2);
    assert.equal(engine.getSnapshot().lastError, null);
    assert.equal(decodePoints(box.points).length, 2);
  });
});

describe("RecordingEngine 종료", () => {
  it("종료 순서: 수집 중단 → 저장 → 정리. 기록 ID 는 세션 ID", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    const { engine, saved } = makeEngine(storage, fc.collector);
    const s = await engine.start("jayu-ro-haengju-imjingak");
    assert.ok(s.ok);
    fc.push(pts(3));
    const r = await engine.finish();
    assert.ok(r.ok);
    assert.equal(r.tripId, s.session.id);
    assert.equal(fc.state.stopCalls, 1);
    assert.equal(fc.state.running, false);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, s.session.id);
    assert.equal(saved[0].kind, "course");
    assert.equal(saved[0].courseId, "jayu-ro-haengju-imjingak");
    assert.equal(saved[0].points.length, 3);
    assert.equal(box.session, null);
    assert.equal(box.points, "");
    assert.equal(engine.getSnapshot().session, null);
  });

  it("종료 연타: 기록은 하나만 저장된다", async () => {
    const { storage } = memoryStorage();
    const fc = fakeCollector();
    const { engine, saved } = makeEngine(storage, fc.collector);
    await engine.start(null);
    fc.push(pts(2));
    const results = await Promise.all([engine.finish(), engine.finish(), engine.finish()]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(saved.length, 1);
  });

  it("종료 처리 중·종료 후에 도착한 좌표는 버린다", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    fc.state.failStop = true; // 중단 실패로 '종료 처리 중'에 머문다
    const { engine } = makeEngine(storage, fc.collector);
    await engine.start(null);
    fc.push(pts(2));
    const r = await engine.finish();
    assert.ok(!r.ok && r.reason === "stop");
    assert.equal(parseSession(box.session)?.status, "stopping");
    assert.equal(engine.handleLocations(pts(2, T0 + 20_000)), 0);
    assert.equal(decodePoints(box.points).length, 2);

    fc.state.failStop = false;
    const r2 = await engine.finish();
    assert.ok(r2.ok);
    assert.equal(engine.handleLocations(pts(2, T0 + 40_000)), 0);
    assert.equal(box.points, "");
  });

  it("저장 실패 후 재시도해도 같은 기록 ID·같은 종료 시각", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    let fail = true;
    const saved: Trip[] = [];
    let now = T0;
    const { engine } = makeEngine(storage, fc.collector, {
      now: () => now,
      saveTrip: async (t) => {
        if (fail) throw new Error("disk full");
        saved.push(t);
      },
    });
    const s = await engine.start(null);
    assert.ok(s.ok);
    fc.push(pts(2));

    now = T0 + 60_000;
    const r1 = await engine.finish();
    assert.ok(!r1.ok && r1.reason === "save");
    assert.ok(engine.getSnapshot().finishError);
    const stopping = parseSession(box.session);
    assert.equal(stopping?.status, "stopping");
    assert.equal(stopping?.stoppedAt, T0 + 60_000);
    assert.equal(stopping?.id, s.session.id);

    now = T0 + 90_000; // 시간이 더 흘러도
    fail = false;
    const r2 = await engine.finish();
    assert.ok(r2.ok);
    assert.equal(r2.tripId, s.session.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, s.session.id);
    assert.equal(saved[0].endedAt, T0 + 60_000);
    assert.equal(saved[0].points.length, 2);
    assert.equal(engine.getSnapshot().finishError, null);
  });

  it("앱을 껐다 켠 뒤(새 컨텍스트) 종료 처리 중이던 세션을 마무리할 수 있다", async () => {
    const { storage, box } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector, {
      saveTrip: async () => {
        throw new Error("fail once");
      },
    });
    const s = await engine.start(null);
    assert.ok(s.ok);
    fc.push(pts(2));
    assert.ok(!(await engine.finish()).ok);

    const { engine: e2, saved } = makeEngine(storage, fc.collector);
    assert.equal(e2.getSnapshot().session?.status, "stopping");
    const r = await e2.finish();
    assert.ok(r.ok);
    assert.equal(r.tripId, s.session.id);
    assert.equal(saved[0].points.length, 2);
    assert.equal(box.session, null);
  });

  it("세션이 없으면 none", async () => {
    const { storage } = memoryStorage();
    const { engine } = makeEngine(storage, fakeCollector().collector);
    const r = await engine.finish();
    assert.ok(!r.ok && r.reason === "none");
  });
});

describe("RecordingEngine 복구", () => {
  it("앱 중단 후 재실행: 저장된 세션을 찾고, 자동으로 새 기록을 만들지 않으며, 빠진 구간은 나뉜다", async () => {
    const { storage } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    const s = await engine.start(null);
    assert.ok(s.ok);
    fc.push(pts(3));

    // 앱이 죽어 수집기도 멈췄다
    fc.state.running = false;
    fc.state.onLocations = undefined;

    // 다시 켠 앱: 새 엔진
    const fc2 = fakeCollector();
    const { engine: e2, saved } = makeEngine(storage, fc2.collector);
    assert.equal(await e2.refreshCollector(), false);
    const snap = e2.getSnapshot();
    assert.equal(snap.session?.id, s.session.id);
    assert.equal(snap.collectorRunning, false);
    assert.equal(snap.points.length, 3);
    assert.equal(fc2.state.startCalls, 0, "자동으로 수집을 다시 켜지 않는다");

    // 사용자가 [이어서 기록]
    const r = await e2.resume();
    assert.ok(r.ok);
    assert.equal(fc2.state.startCalls, 1);
    assert.equal(e2.getSnapshot().collectorRunning, true);

    // 한참 뒤에 다시 좌표가 온다 → 끊긴 구간
    fc2.push(pts(3, T0 + 1000 + GAP_MS * 5, 3000, 37.6));
    const f = await e2.finish();
    assert.ok(f.ok);
    assert.equal(saved[0].points.length, 6);
    const segments = splitSegments(saved[0].points);
    assert.equal(segments.length, 2);
    assert.equal(segments[0].length, 3);
    assert.equal(segments[1].length, 3);
  });

  it("수집기가 아직 돌고 있으면(Android 서비스 유지) resume 은 새로 켜지 않는다", async () => {
    const { storage } = memoryStorage();
    const fc = fakeCollector();
    const { engine } = makeEngine(storage, fc.collector);
    await engine.start(null);

    const { engine: e2 } = makeEngine(storage, fc.collector);
    assert.equal(await e2.refreshCollector(), true);
    const r = await e2.resume();
    assert.ok(r.ok);
    assert.equal(fc.state.startCalls, 1);
  });

  it("세션이 없으면 resume 은 none", async () => {
    const { storage } = memoryStorage();
    const { engine } = makeEngine(storage, fakeCollector().collector);
    const r = await engine.resume();
    assert.ok(!r.ok && r.reason === "none");
  });
});
