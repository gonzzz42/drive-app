import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GAP_MS,
  judgeCompletion,
  pathLengthMeters,
  segmentsLengthMeters,
  splitSegments,
  tripDistanceMeters,
} from "./geo";

// 구간 분리와 거리·완주 판정. 끊긴 자리를 잇지 않는지, 기존 기록(끊김 없음)은 예전과 같은지.

// 북쪽으로 약 111m 씩 n개 점. 3초 간격.
function line(n: number, t0 = 0, stepMs = 3000) {
  return Array.from({ length: n }, (_, i) => ({ lat: 37.5 + i * 0.001, lng: 127, t: t0 + i * stepMs }));
}

describe("splitSegments", () => {
  it("빈 배열은 빈 구간 목록", () => {
    assert.deepEqual(splitSegments([]), []);
  });

  it("끊김이 없으면 구간 하나", () => {
    const pts = line(10);
    const segs = splitSegments(pts);
    assert.equal(segs.length, 1);
    assert.equal(segs[0].length, 10);
  });

  it("GAP_MS 를 넘는 자리에서 나눈다", () => {
    const a = line(5, 0);
    const b = line(5, a[4].t + GAP_MS + 1);
    const segs = splitSegments([...a, ...b]);
    assert.equal(segs.length, 2);
    assert.equal(segs[0].length, 5);
    assert.equal(segs[1].length, 5);
  });

  it("정확히 GAP_MS 만큼은 끊김이 아니다", () => {
    const a = line(2, 0);
    const b = line(2, a[1].t + GAP_MS);
    assert.equal(splitSegments([...a, ...b]).length, 1);
  });
});

describe("거리", () => {
  it("끊김 없는 기록의 거리는 pathLengthMeters 와 같다 (기존 기록 회귀)", () => {
    const pts = line(50);
    assert.equal(tripDistanceMeters(pts), pathLengthMeters(pts));
  });

  it("끊긴 자리는 거리에 넣지 않는다", () => {
    const a = line(5, 0);
    // 멀리 떨어진 곳에서 다시 시작 (10 km 남쪽)
    const b = line(5, a[4].t + GAP_MS * 10).map((p) => ({ ...p, lat: p.lat - 0.1 }));
    const all = [...a, ...b];
    const joined = pathLengthMeters(all);
    const split = tripDistanceMeters(all);
    assert.ok(split < joined - 9000, `끊긴 자리(약 10 km)를 뺐어야 한다: ${split} vs ${joined}`);
    assert.equal(split, segmentsLengthMeters([a, b]));
  });
});

describe("judgeCompletion", () => {
  const course = line(20).map(({ lat, lng }) => ({ lat, lng }));

  it("코스를 그대로 탄 기록은 완주", () => {
    const trip = line(20);
    const r = judgeCompletion(course, splitSegments(trip));
    assert.equal(r.startOk, true);
    assert.equal(r.endOk, true);
    assert.equal(r.overlap, 1);
    assert.equal(r.completed, true);
  });

  it("끊김 없는 기록은 구간 하나로 넘겨도 같은 판정 (기존 기록 회귀)", () => {
    const trip = line(20);
    assert.deepEqual(judgeCompletion(course, [trip]), judgeCompletion(course, splitSegments(trip)));
  });

  it("중간이 끊긴 기록은 빠진 구간을 지나간 것으로 치지 않는다", () => {
    const all = line(20);
    // 6~13번째 점이 사라진 뒤(끊김) 다시 이어진다
    const a = all.slice(0, 6);
    const b = all.slice(14).map((p) => ({ ...p, t: p.t + GAP_MS * 2 }));
    const trip = [...a, ...b];
    const joined = judgeCompletion(course, [trip]); // 끊김을 잇는 옛 방식
    const split = judgeCompletion(course, splitSegments(trip));
    assert.equal(joined.overlap, 1, "잇는 방식은 빠진 구간도 지나간 것으로 본다");
    assert.ok(split.overlap < 0.85, `나눈 방식은 빠진 구간을 세지 않는다: ${split.overlap}`);
    assert.equal(split.startOk, true);
    assert.equal(split.endOk, true);
    assert.equal(split.completed, false);
  });

  it("기록이 없으면 미완주", () => {
    const r = judgeCompletion(course, []);
    assert.equal(r.completed, false);
    assert.equal(r.overlap, 0);
  });
});
