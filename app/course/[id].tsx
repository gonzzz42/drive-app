import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng as MapLatLng,
  type Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse, type Course } from "../../src/lib/courses";
import { naviUrls, openFirst } from "../../src/lib/navi";

// 기본 좌표: 서울 시청
const SEOUL: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const MAP_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

// 위도/경도 두 개가 다 있을 때만 지도 좌표로 바꾼다.
function toLatLng(lat?: number, lng?: number): MapLatLng | undefined {
  if (lat == null || lng == null) return undefined;
  return { latitude: lat, longitude: lng };
}

// 지도에 그릴 경로 좌표. polyline이 비어 있으면 시작/끝 좌표로 대체.
function coursePoints(course: Course): MapLatLng[] {
  if (course.polyline.length > 0) {
    return course.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  }
  const pts: MapLatLng[] = [];
  const start = toLatLng(course.start_lat, course.start_lng);
  const end = toLatLng(course.end_lat, course.end_lng);
  if (start) pts.push(start);
  if (end) pts.push(end);
  return pts;
}

// 좌표 목록을 모두 담는 지도 영역. fitToCoordinates 전에 쓸 첫 화면용.
function regionFor(points: MapLatLng[]): Region {
  if (points.length === 0) return SEOUL;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
  };
}

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [opening, setOpening] = useState(false);
  const course = getCourse(id);

  if (!course) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>코스를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const points = coursePoints(course);
  // 시작/끝 마커: 코스의 시작·끝 좌표. 없으면 경로의 첫/마지막 점.
  const start =
    toLatLng(course.start_lat, course.start_lng) ??
    (points.length > 0 ? points[0] : undefined);
  const end =
    toLatLng(course.end_lat, course.end_lng) ??
    (points.length > 1 ? points[points.length - 1] : undefined);
  const distance =
    course.distance_km > 0 ? `${course.distance_km} km` : "거리 미정";

  // 내비 목적지는 코스 "시작점". 좌표가 있으면 좌표, 없으면 시작점 이름으로 검색.
  const target = {
    name: course.start_name,
    lat: course.start_lat,
    lng: course.start_lng,
    keyword: course.start_name,
  };

  // 티맵을 먼저, 없으면 카카오맵. 기록 화면으로 자동 이동하지 않는다.
  async function openNavi() {
    if (opening) return;
    setOpening(true);
    try {
      const ok = await openFirst(naviUrls(target));
      if (!ok) {
        // 티맵 → 카카오맵 → 카카오 웹 순서로 모두 실패한 경우 (브라우저까지 없을 때)
        Alert.alert("내비를 열 수 없습니다", "티맵, 카카오맵, 브라우저를 모두 열지 못했습니다.");
      }
    } finally {
      setOpening(false);
    }
  }

  function fitMap() {
    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: MAP_PADDING,
        animated: false,
      });
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: course.name }} />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionFor(points)}
        onMapReady={fitMap}
      >
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeWidth={4} strokeColor="#0a66c2" />
        ) : null}
        {start ? <Marker coordinate={start} title={course.start_name} /> : null}
        {end ? (
          <Marker coordinate={end} title={course.end_name} pinColor="#0a66c2" />
        ) : null}
      </MapView>
      {points.length === 0 ? (
        <Text style={styles.noRoute}>경로 좌표가 아직 없는 코스입니다.</Text>
      ) : null}

      <ScrollView style={styles.info} contentContainerStyle={styles.infoContent}>
        <Text style={styles.name}>{course.name}</Text>
        <Text style={styles.meta}>
          {course.region} · {distance}
        </Text>
        <Text style={styles.meta}>
          {course.start_name} → {course.end_name}
        </Text>
        {course.best_time ? (
          <Text style={styles.meta}>추천 시간: {course.best_time}</Text>
        ) : null}
        {course.avoid_time ? (
          <Text style={styles.meta}>피할 시간: {course.avoid_time}</Text>
        ) : null}
      </ScrollView>

      <View style={[styles.buttons, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.notice}>인증 카드를 남기려면 출발 전에 기록을 켜 두세요.</Text>
        <Pressable
          style={[styles.primaryButton, opening && styles.disabled]}
          onPress={openNavi}
          disabled={opening}
        >
          <Text style={styles.primaryButtonText}>티맵으로 시작점까지 가기</Text>
          <Text style={styles.primaryButtonSub}>티맵이 없으면 카카오맵으로 열립니다</Text>
        </Pressable>
        <Pressable
          style={styles.textButton}
          onPress={() => router.push(`/record/${course.id}`)}
          hitSlop={8}
        >
          <Text style={styles.textButtonLabel}>기록만 시작</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { height: 260, width: "100%" },
  noRoute: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    paddingVertical: 6,
  },
  info: { flex: 1 },
  infoContent: { padding: 16, gap: 6 },
  name: { fontSize: 22, fontWeight: "700", color: "#111" },
  meta: { fontSize: 15, color: "#555" },
  empty: { color: "#888" },
  buttons: { padding: 16, gap: 10 },
  notice: { fontSize: 13, color: "#666", textAlign: "center" },
  primaryButton: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  primaryButtonSub: { color: "#9ab", fontSize: 12 },
  disabled: { opacity: 0.5 },
  textButton: { alignItems: "center", paddingVertical: 8 },
  textButtonLabel: { color: "#888", fontSize: 15, fontWeight: "600" },
});
