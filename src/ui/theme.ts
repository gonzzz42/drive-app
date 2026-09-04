import { StyleSheet } from "react-native";
import type { MapStyleElement } from "react-native-maps";

// 디자인 토큰. 기준: prompts/DESIGN_260904.md
// 화면은 여기 값만 쓴다. 새 색·새 크기를 화면 안에서 만들지 않는다.

export const colors = {
  bg: "#F6F5F1", // 화면 바탕, RouteSketch 바탕, 결과 카드 바탕
  surface: "#FFFFFF", // 시작 탭 패널, 추천 카드, 탭바
  ink: "#15233A", // 제목·본문·굵은 숫자
  text2: "#6B7280", // 보조 글(구간, 날짜, 출처, 보조 버튼, 비활성 탭)
  line: "#E5E3DC", // 구분선, 카드·썸네일 테두리 (0.5px)
  accent: "#2766C7", // 경로선, 시작 점, 메인 버튼, 활성 탭
  accentPressed: "#1F55A8", // 메인 버튼 눌림
  pinEnd: "#E8604C", // 도착 점·핀만
  danger: "#C0392B", // 오류 문구 글자색만
};

export const radius = {
  card: 16,
  button: 16,
  thumb: 12,
  panelTop: 20, // 시작 탭 패널 위쪽
};

export const space = {
  screen: 20, // 화면 좌우 여백
  gap: 12, // 요소 간격
};

export const hairline = 0.5; // 구분선·테두리 굵기

// 버튼 두 종류. 메인은 파란 바탕, 보조는 글자만.
export const buttons = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: radius.button,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  primaryPressed: { backgroundColor: colors.accentPressed },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  secondary: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  secondaryText: { color: colors.text2, fontSize: 15, fontWeight: "500" },
});

// Android 지도: 채도 낮은 밝은 지도. (iOS는 userInterfaceStyle="light"로 충분)
export const lightMapStyle: MapStyleElement[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ saturation: -70 }, { lightness: 10 }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#DBE4EA" }] },
];
