import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng as MapLatLng,
  type Region,
} from "react-native-maps";
import { courses, type Course, type LatLng } from "../../src/lib/courses";
import { distanceLabel, roundTripLabel } from "../../src/lib/format";
import { naviUrls, openFirst, startTarget } from "../../src/lib/navi";
import {
  DUMMY_LOCATION,
  estimateRoundTripMinutes,
  pickTodayCourse,
} from "../../src/lib/recommend";
import { RouteSketch, STATIC_ROUTE_ONLY } from "../../src/ui/RouteSketch";
import { buttons, colors, lightMapStyle, radius, space } from "../../src/ui/theme";

// 시작 탭: 위 60% 지도, 아래 40% 패널(오늘의 코스 → 코스명 → 구간 → 예상 시간 → 길찾기).
// 기록은 여기서 시작하지 않는다. Android Expo Go에서는 지도 대신 정적 경로 그림.

// 기본 좌표: 서울 시청
const SEOUL: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

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

// 좌표 목록을 모두 담는 지도 영역 (첫 화면용)
function regionFor(points: LatLng[]): Region {
  if (points.length === 0) return SEOUL;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
  };
}

export default function StartScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  const [opening, setOpening] = useState(false);
  // 내 위치. 권한 거부·실패·로딩 중이면 undefined → 더미 위치(서울 강서)로 고른다.
  const [here, setHere] = useState<LatLng | undefined>();

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        const pos =
          last ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }));
        if (alive) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // 위치를 못 잡으면 더미 위치 그대로
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  const base = here ?? DUMMY_LOCATION;
  const pick = pickTodayCourse(courses, new Date(), base);
  const line: LatLng[] = pick ? pick.polyline : [];
  const start = pick ? startOf(pick) : undefined;
  const end = pick ? endOf(pick) : undefined;
  // 지도에 담을 점: 경로선 + 시작 + 도착 (내 위치는 넣지 않는다)
  const bounds: LatLng[] = [...line];
  if (start) bounds.push(start);
  if (end) bounds.push(end);
  // 정적 그림용 점: 경로선. 없으면 시작·도착만.
  const sketchPoints: LatLng[] =
    line.length > 0 ? line : [start, end].filter((p): p is LatLng => p != null);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (bounds.length >= 2) {
      mapRef.current.fitToCoordinates(bounds.map(toMap), {
        edgePadding: MAP_PADDING,
        animated: false,
      });
    } else if (bounds.length === 1) {
      mapRef.current.animateToRegion(
        { ...toMap(bounds[0]), latitudeDelta: 0.05, longitudeDelta: 0.05 },
        0,
      );
    }
    // 코스가 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pick?.id]);

  // 내비 앱으로 코스 시작점까지. 기록 화면으로 이동하지 않는다.
  async function openNavi() {
    if (!pick || opening) return;
    setOpening(true);
    try {
      const ok = await openFirst(naviUrls(startTarget(pick)));
      if (!ok) Alert.alert("길찾기를 열 수 없습니다", "설치된 내비 앱이 없습니다.");
    } finally {
      setOpening(false);
    }
  }

  function onMapLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setMapSize({ w: width, h: height });
  }

  const timeText = pick
    ? (roundTripLabel(estimateRoundTripMinutes(pick, base)) ?? distanceLabel(pick.distance_km))
    : "";

  return (
    <View style={styles.container}>
      {/* 지도 60%. 터치는 막는다. */}
      <View style={styles.map} pointerEvents="none" onLayout={onMapLayout}>
        {STATIC_ROUTE_ONLY ? (
          mapSize.w > 0 ? (
            <RouteSketch points={sketchPoints} width={mapSize.w} height={mapSize.h} stroke={4} />
          ) : null
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={regionFor(bounds)}
            userInterfaceStyle="light"
            customMapStyle={Platform.OS === "android" ? lightMapStyle : undefined}
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
              <Marker
                coordinate={toMap(start)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={styles.startDot} />
              </Marker>
            ) : null}
            {end ? <Marker coordinate={toMap(end)} pinColor={colors.pinEnd} /> : null}
          </MapView>
        )}
      </View>

      {/* 패널 40%. 지도와 20 겹친다. 안에 카드를 또 넣지 않는다. */}
      <View style={styles.panel}>
        <Text style={styles.label}>오늘의 코스</Text>
        {pick ? (
          <>
            <Pressable onPress={() => router.push(`/course/${pick.id}`)} style={styles.titleBlock}>
              <Text style={styles.name} numberOfLines={2}>
                {pick.name}
              </Text>
              <Text style={styles.route} numberOfLines={1}>
                {pick.start_name} → {pick.end_name}
              </Text>
            </Pressable>
            <Text style={styles.time}>{timeText}</Text>
          </>
        ) : (
          <Text style={styles.route}>좌표가 있는 코스가 없습니다</Text>
        )}

        <Pressable
          style={({ pressed }) => [
            buttons.primary,
            styles.button,
            pressed && buttons.primaryPressed,
            (!pick || opening) && buttons.primaryDisabled,
          ]}
          onPress={openNavi}
          disabled={!pick || opening}
        >
          <Text style={buttons.primaryText}>길찾기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 60, backgroundColor: colors.bg },
  panel: {
    flex: 40,
    marginTop: -radius.panelTop,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.panelTop,
    borderTopRightRadius: radius.panelTop,
    padding: space.screen,
    gap: space.gap,
  },
  label: { fontSize: 13, color: colors.text2 },
  titleBlock: { gap: 4 },
  name: { fontSize: 28, fontWeight: "700", color: colors.ink },
  route: { fontSize: 16, color: colors.text2 },
  time: { fontSize: 16, fontWeight: "600", color: colors.ink },
  button: { marginTop: "auto" },
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
