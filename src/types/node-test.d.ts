// 테스트 전용 최소 타입. @types/node 를 넣지 않고 node:test / node:assert 중 쓰는 것만 선언한다.
// 테스트는 scripts/test.js 가 Node 로 실행한다.

declare module "node:test" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  function ok(value: unknown, message?: string): asserts value;
  function equal(actual: unknown, expected: unknown, message?: string): void;
  function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  const assert: {
    ok: typeof ok;
    equal: typeof equal;
    deepEqual: typeof deepEqual;
  };
  export default assert;
}
