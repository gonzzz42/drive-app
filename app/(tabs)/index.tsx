import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng as MapLatLng,
  type Region,
} from "react-native-maps";
import { courses, getCourse, type Course, type LatLng } from "../../src/lib/courses";
import { distanceLabel } from "../../src/lib/format";
import { distanceMeters } from "../../src/lib/geo";
import { DUMMY_LOCATION, recommendCourses } from "../../src/lib/recommend";
import { startRecording, useRecording } from "../../src/lib/recording";
import { selectCourse, useSelectedCourse } from "../../src/lib/selection";
import { useHere, type HereStatus } from "../../src/lib/useHere";
import { RouteSketch, STATIC_ROUTE_ONLY } from "../../src/ui/RouteSketch";
import { buttons, colors, hairline, lightMapStyle, radius, space } from "../../src/ui/theme";

// 드라이브 탭: 내 위치 지도 → [드라이브 시작] (기본 자유주행) → 선택한 코스가 있으면 [이 코스로 시작]
// → 추천 코스 최대 3개 + [코스 더 보기]. 진행 중인 기록이 있으면 [기록으로 돌아가기]가 기본 행동.
// Android Expo Go에서는 지도 대신 정적 경로 그림.

// 탐색용 기본 지도(서울 시청). 권한이 없을 때 '내 위치'로 보여주지 않는다.
const SEOUL: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};
const HERE_DELTA = 0.02; // 내 위치 주변 2 km 정도
const MAX_NEARBY = 3;
// 지도 높이 = 화면 높이의 40%. 아래 패널은 ScrollView 라 flex 비율 대신 고정 높이로 나눈다.
// (ScrollView 는 기본 flexGrow 가 1이라 flex: 58 같은 비율이 먹지 않는다)
const MAP_HEIGHT_RATIO = 0.4;
const MAP_PADDING = { top: 40, right: 40, bottom: 40 + radius.panelTop, left: 40 };

function toMap(p: LatLng): MapLatLng {
  return { latitude: p.lat, longitude: p.lng };
}

// 시작·도착 좌표. 코스에 없으면 경로선의 첫·마지막 점.
function startOf(c: Course): LatLng | undefined {
  if (c.start_lat != null && c.start_lng != null) return { lat: c.start_lat, lng: c.start_lng };
  return c.polyline[0];
}
function endOf(c: Course): LatLng | undefined {
  if (c.end_lat != null && c.end_lng != null) return { lat: c.end_lat, lng: c.end_lng };
  return c.polyline.length > 1 ? c.polyline[c.polyline.length - 1] : undefined;
}
// 지도에 담을 점: 경로선 + 시작 + 도착
function boundsOf(c: Course): LatLng[] {
  const pts: LatLng[] = [...c.polyline];
  const s = startOf(c);
  const e = endOf(c);
  if (s) pts.push(s);
  if (e) pts.push(e);
  return pts;
}

function locationText(status: HereStatus): string {
  switch (status) {
    case "loading":
      return "내 위치 확인 중…";
    case "denied":
      return "위치 권한이 없습니다. 설정에서 허용해 주세요.";
    case "unavailable":
      return "위치를 확인할 수 없습니다. 위치 서비스를 켜 주세요.";
    default:
      return "내 위치 확인됨";
  }
}

// 출발점까지 직선거리 (여기를 모르면 undefined)
function startDistanceKm(c: Course, here: LatLng | undefined): number | undefined {
  const s = startOf(c);
  if (!s || !here) return undefined;
  return distanceMeters(here, s) / 1000;
}

export default function DriveScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const mapHeight = Math.round(height * MAP_HEIGHT_RATIO);
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  const [starting, setStarting] = useState(false);
  const { status, here } = useHere();
  const selected = useSelectedCourse();
  const { session } = useRecording();

  // 지도 맞추기: 선택한 코스가 있으면 코스 전체, 없으면 내 위치
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (selected) {
      const b = boundsOf(selected);
      if (b.length >= 2) {
        mapRef.current.fitToCoordinates(b.map(toMap), { edgePadding: MAP_PADDING, animated: false });
      } else if (b.length === 1) {
        mapRef.current.animateToRegion({ ...toMap(b[0]), latitudeDelta: 0.05, longitudeDelta: 0.05 }, 0);
      }
    } else if (here) {
      mapRef.current.animateToRegion(
        { ...toMap(here), latitudeDelta: HERE_DELTA, longitudeDelta: HERE_DELTA },
        300,
      );
    }
    // 코스 선택이나 내 위치가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selected?.id, here?.lat, here?.lng]);

  function onMapLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ w: width, h: height });
  }

  // 드라이브 시작. 코스가 없으면 자유주행. 권한·수집 실패는 성공으로 보이지 않는다.
  async function onStart() {
    if (session) {
      router.push("/record");
      return;
    }
    if (starting) return;
    setStarting(true);
    const result = await startRecording(selected?.id ?? null);
    setStarting(false);
    if (result.ok) {
      selectCourse(null); // 세션이 코스를 갖고 있으므로 선택은 비운다
      router.push("/record");
      return;
    }
    if (result.reason === "active") {
      router.push("/record");
      return;
    }
    if (result.reason === "busy") return;
    Alert.alert("기록을 시작할 수 없습니다", result.message);
  }

  const sessionCourse = session?.courseId ? getCourse(session.courseId) : undefined;
  const sessionTitle = session
    ? session.kind === "free"
      ? "자유 드라이브"
      : (sessionCourse?.name ?? "코스 정보 없음")
    : "";

  const nearby = recommendCourses(courses, new Date(), here ?? DUMMY_LOCATION).slice(0, MAX_NEARBY);

  // 지도에 그릴 코스 (선택한 것만)
  const line = selected ? selected.polyline : [];
  const start = selected ? startOf(selected) : undefined;
  const end = selected ? endOf(selected) : undefined;
  const sketchPoints: LatLng[] =
    line.length > 0 ? line : [start, end].filter((p): p is LatLng => p != null);

  return (
    <View style={styles.container}>
      {/* 지도. 터치는 막는다. */}
      <View style={[styles.map, { height: mapHeight }]} pointerEvents="none" onLayout={onMapLayout}>
        {STATIC_ROUTE_ONLY ? (
          mapSize.w > 0 && selected ? (
            <RouteSketch points={sketchPoints} width={mapSize.w} height={mapSize.h} stroke={4} />
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyText}>지도는 개발 빌드에서 표시됩니다</Text>
            </View>
          )
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={SEOUL}
            userInterfaceStyle="light"
            customMapStyle={Platform.OS === "android" ? lightMapStyle : undefined}
            showsUserLocation={status === "ready"}
            showsMyLocationButton={false}
            showsPointsOfInterests={false}
            showsCompass={false}
            toolbarEnabled={false}
            onMapReady={() => setMapReady(true)}
          >
            {line.length > 1 ? (
              <Polyline
                coordinates={line.map(toMap)}
                strokeColor={colors.accent}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
                lineDashPattern={line.length < 4 ? [1, 10] : undefined}
              />
            ) : null}
            {start ? (
              <Marker coordinate={toMap(start)} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={styles.startDot} />
              </Marker>
            ) : null}
            {end ? <Marker coordinate={toMap(end)} pinColor={colors.pinEnd} /> : null}
          </MapView>
        )}
      </View>

      {/* 패널. 지도와 20 겹친다. */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        {session ? (
          <>
            <Text style={styles.label}>기록 중</Text>
            <Text style={styles.name} numberOfLines={2}>
              {sessionTitle}
            </Text>
            <Text style={styles.sub}>기록이 진행 중입니다</Text>
            <Pressable
              style={({ pressed }) => [buttons.primary, styles.button, pressed && buttons.primaryPressed]}
              onPress={onStart}
            >
              <Text style={buttons.primaryText}>기록으로 돌아가기</Text>
            </Pressable>
          </>
        ) : selected ? (
          <>
            <Text style={styles.label}>선택한 코스</Text>
            <Pressable onPress={() => router.push(`/course/${selected.id}`)} style={styles.titleBlock}>
              <Text style={styles.name} numberOfLines={2}>
                {selected.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {selected.start_name} → {selected.end_name}
              </Text>
            </Pressable>
            <Text style={[styles.status, status === "denied" && styles.warn]}>
              {locationText(status)}
            </Text>
            <Pressable
              style={({ pressed }) => [
                buttons.primary,
                styles.button,
                pressed && buttons.primaryPressed,
                starting && buttons.primaryDisabled,
              ]}
              onPress={onStart}
              disabled={starting}
            >
              <Text style={buttons.primaryText}>{starting ? "시작하는 중…" : "이 코스로 시작"}</Text>
            </Pressable>
            <Pressable style={buttons.secondary} onPress={() => selectCourse(null)}>
              <Text style={buttons.secondaryText}>코스 해제</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>자유 드라이브</Text>
            <Text style={styles.name}>현재 위치에서 시작</Text>
            <Text style={[styles.status, status === "denied" && styles.warn]}>
              {locationText(status)}
            </Text>
            <Pressable
              style={({ pressed }) => [
                buttons.primary,
                styles.button,
                pressed && buttons.primaryPressed,
                starting && buttons.primaryDisabled,
              ]}
              onPress={onStart}
              disabled={starting}
            >
              <Text style={buttons.primaryText}>{starting ? "시작하는 중…" : "드라이브 시작"}</Text>
            </Pressable>
          </>
        )}

        <Text style={styles.sectionTitle}>추천 코스</Text>
        {nearby.length === 0 ? (
          <Text style={styles.sub}>코스가 없습니다</Text>
        ) : (
          nearby.map((c, i) => {
            const km = startDistanceKm(c, here);
            return (
              <Pressable
                key={c.id}
                style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
                onPress={() => router.push(`/course/${c.id}`)}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {km != null
                      ? `출발점까지 직선 ${distanceLabel(km)}`
                      : `${c.start_name} → ${c.end_name}`}
                  </Text>
                </View>
                <RouteSketch points={c.polyline} width={THUMB} height={THUMB} radius={radius.thumb} />
              </Pressable>
            );
          })
        )}
        <Pressable style={buttons.secondary} onPress={() => router.navigate("/browse")}>
          <Text style={buttons.secondaryText}>코스 더 보기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const THUMB = 56;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { backgroundColor: colors.bg },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapEmptyText: { fontSize: 13, color: colors.text2 },
  panel: {
    flex: 1,
    marginTop: -radius.panelTop,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.panelTop,
    borderTopRightRadius: radius.panelTop,
  },
  panelContent: { padding: space.screen, gap: space.gap, paddingBottom: space.screen },
  label: { fontSize: 13, color: colors.text2 },
  titleBlock: { gap: 4 },
  name: { fontSize: 28, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 16, color: colors.text2 },
  status: { fontSize: 14, color: colors.text2 },
  warn: { color: colors.danger },
  button: { marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.ink, marginTop: space.gap },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.gap,
    paddingVertical: space.gap,
  },
  rowLine: { borderTopWidth: hairline, borderTopColor: colors.line },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: "600", color: colors.ink },
  rowSub: { fontSize: 13, color: colors.text2 },
  // 시작 마커: 파란 원 12, 흰 테두리 2.5
  startDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
  },
});
