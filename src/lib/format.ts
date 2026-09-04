// 화면에 보이는 숫자 문구. 기준: prompts/DESIGN_260904.md 2장

// 예상 시간. 칸으로 말한다.
//   셀 수 없으면(Infinity·NaN) null → 그 자리에 distanceLabel을 대신 쓴다
//   40분 미만 → "왕복 35분"
//   40분 이상 → 30분 칸: "왕복 1시간", "왕복 1시간 반", "왕복 2시간", "왕복 2시간 반" …
export function roundTripLabel(minutes: number): string | null {
  if (!Number.isFinite(minutes)) return null;
  const min = Math.max(0, Math.round(minutes));
  if (min < 40) return `왕복 ${min}분`;
  const halfHours = 2 + Math.floor((min - 40) / 30);
  const hours = Math.floor(halfHours / 2);
  return halfHours % 2 === 0 ? `왕복 ${hours}시간` : `왕복 ${hours}시간 반`;
}

// 기록된 시간. 실제로 말한다. "58분", "1시간 24분", 분이 0이면 "1시간"
export function durationLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

// "12.4 km" (소수 한 자리, 띄어쓰기 있음)
export function distanceLabel(km: number): string {
  const v = Number.isFinite(km) ? km : 0;
  return `${v.toFixed(1)} km`;
}

// 날짜. 히스토리는 "9월 4일", 결과 카드는 "2026.09.03"
export function dateLabel(ms: number, style: "monthDay" | "dotted" = "monthDay"): string {
  const d = new Date(ms);
  if (style === "dotted") {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}.${mm}.${dd}`;
  }
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
