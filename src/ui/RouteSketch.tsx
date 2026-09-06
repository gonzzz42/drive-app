import Constants, { AppOwnership, ExecutionEnvironment } from "expo-constants";
import { Platform, View } from "react-native";
import { Circle, Polyline, Svg } from "react-native-svg";
import type { LatLng } from "../lib/courses";
import { colors, hairline } from "./theme";

// 정적 경로 그림. 지도 타일 없이 SVG로 그린다.
// 추천 카드, 전체 코스 썸네일, 히스토리 썸네일, 결과 카드에 같은 컴포넌트를 쓴다.
// 기준: prompts/DESIGN_260904.md 2장
// 기록이 끊긴 자리(segments)는 선으로 잇지 않고 비워 둔다.

// Android Expo Go는 구글 지도 키가 만료돼 MapView가 검게 나온다.
// 그때만 시작 탭·상세의 지도 자리에 이 그림을 대신 그린다. 개발 빌드와 iOS는 실제 지도.
export const STATIC_ROUTE_ONLY =
  Platform.OS === "android" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient &&
  Constants.appOwnership === AppOwnership.Expo;

type Props = {
  points?: LatLng[]; // 이어진 선 하나
  segments?: LatLng[][]; // 끊긴 자리로 나눈 선들. 있으면 points 대신 쓴다
  width: number;
  height: number;
  stroke?: number; // 선 굵기 (기본 3)
  pins?: boolean; // 시작·도착 점 (기본 true)
  radius?: number; // 모서리 (부모가 정함, 기본 0)
};

const MARGIN = 0.16; // 위아래·좌우 여백 16%
const MIN_SPAN_DEG = 0.001; // 약 100m. 점 하나·직선도 가운데에 놓이게 하는 최소 범위
const DOT_R = 5;
const MAX_POINTS = 300; // 아주 긴 궤적은 이 개수로 줄인다
const MIN_SEG_PX = 1; // 화면에서 이보다 가까운 점은 하나로 본다

type XY = { x: number; y: number };

// 점이 너무 많으면 균등하게 골라낸다 (첫 점·끝 점은 유지)
function thin(points: LatLng[], max: number): LatLng[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

// 위경도 → 상자 안 픽셀 좌표. 비율을 지키고(긴 쪽 기준) 가운데에 맞춘다.
function project(points: LatLng[], width: number, height: number): XY[] {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // 경도 1도의 실제 길이는 위도가 높을수록 짧다
  const cos = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const realX = (maxLng - minLng) * cos;
  const realY = maxLat - minLat;
  const spanX = Math.max(realX, MIN_SPAN_DEG);
  const spanY = Math.max(realY, MIN_SPAN_DEG);
  const innerW = width * (1 - MARGIN * 2);
  const innerH = height * (1 - MARGIN * 2);
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return points.map((p) => ({
    x: offX + ((p.lng - minLng) * cos + (spanX - realX) / 2) * scale,
    y: offY + (maxLat - p.lat + (spanY - realY) / 2) * scale,
  }));
}

// 화면 좌표에서 너무 가까운 점을 버린다 (첫 점·끝 점은 유지). 작은 썸네일에서 선이 뭉개지지 않게.
function simplifyPx(pts: XY[], minPx: number): XY[] {
  if (pts.length < 3) return pts;
  const out: XY[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1];
    const isLast = i === pts.length - 1;
    if (isLast || Math.hypot(pts[i].x - last.x, pts[i].y - last.y) >= minPx) out.push(pts[i]);
  }
  return out;
}

export function RouteSketch({
  points,
  segments,
  width,
  height,
  stroke = 3,
  pins = true,
  radius = 0,
}: Props) {
  // 빈 구간은 버리고, 구간마다 점을 줄인 뒤, 전체를 한 상자에 투영한다
  const segs = (segments ?? (points ? [points] : []))
    .filter((s) => s.length > 0)
    .map((s) => thin(s, MAX_POINTS));
  const flat = segs.flat();
  const projected = flat.length > 0 ? project(flat, width, height) : [];
  const lines: XY[][] = [];
  let offset = 0;
  for (const s of segs) {
    lines.push(simplifyPx(projected.slice(offset, offset + s.length), MIN_SEG_PX));
    offset += s.length;
  }
  const first = lines[0];
  const last = lines[lines.length - 1];
  const start = first ? first[0] : undefined;
  const end = last && flat.length > 1 ? last[last.length - 1] : undefined;
  // 원래 점이 4개 미만이면 실선 대신 점선 (좌표가 대략적이라는 뜻)
  const totalPoints = (segments ?? (points ? [points] : [])).reduce((n, s) => n + s.length, 0);
  const dotted = totalPoints < 4;

  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
        backgroundColor: colors.bg,
        borderWidth: hairline,
        borderColor: colors.line,
      }}
    >
      <Svg width={width} height={height}>
        {lines.map((pts, i) =>
          pts.length > 1 ? (
            <Polyline
              key={i}
              points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke={colors.accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dotted ? "1 8" : undefined}
            />
          ) : null,
        )}
        {pins && start ? (
          <Circle
            cx={start.x}
            cy={start.y}
            r={DOT_R}
            fill={colors.accent}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        ) : null}
        {pins && end ? (
          <Circle
            cx={end.x}
            cy={end.y}
            r={DOT_R}
            fill={colors.pinEnd}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        ) : null}
      </Svg>
    </View>
  );
}
