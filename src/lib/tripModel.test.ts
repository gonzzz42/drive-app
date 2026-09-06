import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTrip, tripKind, tripTitle } from "./tripModel";

// 기록 데이터 호환: 예전 코스 기록 · 새 자유주행 · 찾을 수 없는 코스

describe("normalizeTrip", () => {
  it("예전 기록(kind 없음, courseId 문자열)을 그대로 살린다", () => {
    const raw = {
      id: "1757000000000",
      courseId: "jayu-ro-haengju-imjingak",
      startedAt: 1757000000000,
      endedAt: 1757003600000,
      points: [{ lat: 37.6, lng: 126.8, t: 1757000003000 }],
      serverId: "abc",
    };
    const trip = normalizeTrip(raw);
    assert.ok(trip);
    assert.equal(trip.kind, undefined);
    assert.equal(trip.courseId, "jayu-ro-haengju-imjingak");
    assert.equal(trip.serverId, "abc");
    assert.equal(trip.points.length, 1);
    assert.equal(tripKind(trip), "course");
  });

  it("예전 기록의 빈 courseId 는 자유주행이 아니라 '코스 정보 없음'", () => {
    const trip = normalizeTrip({ id: "a", courseId: "", startedAt: 1, endedAt: 2, points: [] });
    assert.ok(trip);
    assert.equal(tripKind(trip), "unknown");
    assert.equal(tripTitle(trip), "코스 정보 없음");
  });

  it("courseId 가 아예 없는 예전 기록도 자유주행으로 바꾸지 않는다", () => {
    const trip = normalizeTrip({ id: "a", startedAt: 1, endedAt: 2, points: [] });
    assert.ok(trip);
    assert.equal(trip.courseId, null);
    assert.equal(tripKind(trip), "unknown");
  });

  it("새 자유주행은 kind free 로 읽힌다", () => {
    const trip = normalizeTrip({
      id: "b",
      kind: "free",
      courseId: null,
      startedAt: 1,
      endedAt: 2,
      points: [],
    });
    assert.ok(trip);
    assert.equal(tripKind(trip), "free");
    assert.equal(tripTitle(trip), "자유 드라이브");
    assert.equal(tripTitle(trip, "무시되는 코스명"), "자유 드라이브");
  });

  it("코스 주행인데 지금 코스를 못 찾으면 '코스 정보 없음'", () => {
    const trip = normalizeTrip({
      id: "c",
      kind: "course",
      courseId: "deleted-course",
      startedAt: 1,
      endedAt: 2,
      points: [],
    });
    assert.ok(trip);
    assert.equal(tripKind(trip), "course");
    assert.equal(tripTitle(trip, undefined), "코스 정보 없음");
    assert.equal(tripTitle(trip, "자유로"), "자유로");
  });

  it("모양이 아닌 값·깨진 좌표는 걸러낸다", () => {
    assert.equal(normalizeTrip(null), undefined);
    assert.equal(normalizeTrip("x"), undefined);
    assert.equal(normalizeTrip({ id: "", startedAt: 1, endedAt: 2, points: [] }), undefined);
    assert.equal(normalizeTrip({ id: "a", startedAt: "1", endedAt: 2, points: [] }), undefined);
    assert.equal(normalizeTrip({ id: "a", startedAt: 1, endedAt: 2, points: "no" }), undefined);
    const trip = normalizeTrip({
      id: "a",
      startedAt: 1,
      endedAt: 2,
      points: [{ lat: 1, lng: 2, t: 3 }, { lat: "x" }, null, { lat: 1, lng: 2 }],
    });
    assert.ok(trip);
    assert.deepEqual(trip.points, [{ lat: 1, lng: 2, t: 3 }]);
  });

  it("알 수 없는 kind 값은 버리고 예전 기록처럼 읽는다", () => {
    const trip = normalizeTrip({ id: "a", kind: "weird", courseId: "x", startedAt: 1, endedAt: 2, points: [] });
    assert.ok(trip);
    assert.equal(trip.kind, undefined);
    assert.equal(tripKind(trip), "course");
  });
});
