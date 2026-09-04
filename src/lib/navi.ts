import { Linking } from "react-native";
import type { Course } from "./courses";

// 외부 내비 앱(티맵, 카카오맵)을 URL 스킴으로 여는 헬퍼.
// 네이티브 SDK는 쓰지 않는다.
//
// 참고
// - 내비 목적지는 코스의 "시작점"이다. 코스 시작까지 내비로 가고, 코스는 직접 탄다.
// - 티맵은 tmap:// 스킴을 공식 문서로 공개하지 않는다. 아래 형식은 개발자 보고에서
//   iOS/Android 모두 동작이 확인된 것(goalname/goalx/goaly + referrer)이다.
// - 카카오내비는 외부 앱용 URL 스킴을 지원하지 않는다(카카오모빌리티 답변, 2025-05).
//   그래서 "카카오"는 카카오맵 앱(자동차 길찾기 내장)을 연다.
// - 출발지는 넘기지 않는다. 티맵·카카오맵 모두 각자 앱의 위치 권한이 켜져 있으면
//   현재 위치를 출발지로 쓴다.
// - Linking.canOpenURL은 Expo Go에서 항상 false가 나올 수 있어 쓰지 않는다.
//   대신 openURL을 바로 시도하고, 실패(reject)하면 다음 URL로 넘어간다.

export type NaviTarget = {
  name: string; // 목적지 이름 (예: 마곡대교)
  lat?: number; // 목적지 위도 (없으면 keyword 검색으로 연다)
  lng?: number; // 목적지 경도
  keyword: string; // 좌표가 없을 때 쓸 검색어
};

// 코스 시작점을 내비 목적지로. 좌표가 있으면 좌표, 없으면 시작점 이름으로 검색.
export function startTarget(course: Course): NaviTarget {
  return {
    name: course.start_name,
    lat: course.start_lat,
    lng: course.start_lng,
    keyword: course.start_name,
  };
}

function hasCoords(t: NaviTarget): t is NaviTarget & { lat: number; lng: number } {
  return typeof t.lat === "number" && typeof t.lng === "number";
}

// 티맵: 좌표가 있으면 길안내, 없으면 검색어로 검색 화면.
// 티맵은 웹 대체 링크가 없어서 앱이 없으면 그냥 실패한다.
export function tmapUrls(t: NaviTarget): string[] {
  if (hasCoords(t)) {
    const name = encodeURIComponent(t.name);
    return [
      `tmap://route?referrer=com.skt.Tmap&goalname=${name}&goalx=${t.lng}&goaly=${t.lat}`,
    ];
  }
  return [`tmap://search?name=${encodeURIComponent(t.keyword)}`];
}

// 카카오맵: 앱 스킴을 먼저 시도하고, 안 되면 카카오 공식 웹 브리지로 연다.
// (브리지는 앱 설치 페이지 또는 모바일웹 지도로 안내한다)
// 좌표 순서는 위도,경도.
export function kakaoUrls(t: NaviTarget): string[] {
  if (hasCoords(t)) {
    const query = `ep=${t.lat},${t.lng}&by=car`;
    return [
      `kakaomap://route?${query}`,
      `https://m.map.kakao.com/scheme/route?${query}`,
    ];
  }
  const q = encodeURIComponent(t.keyword);
  return [`kakaomap://search?q=${q}`, `https://m.map.kakao.com/scheme/search?q=${q}`];
}

// 티맵을 먼저 시도하고, 티맵이 없으면 카카오맵(앱 → 웹 브리지) 순서.
export function naviUrls(t: NaviTarget): string[] {
  return [...tmapUrls(t), ...kakaoUrls(t)];
}

// URL을 순서대로 열어 보고, 하나라도 성공하면 true.
// 앱이 없으면 openURL이 실패(reject)하므로 다음 URL로 넘어간다.
export async function openFirst(urls: string[]): Promise<boolean> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // 다음 URL 시도
    }
  }
  return false;
}
