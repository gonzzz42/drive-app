import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng as MapLatLng,
  type Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse, type Course, type LatLng } from "../../src/lib/courses";
import { distanceLabel, roundTripLabel } from "../../src/lib/format";
import { naviUrls, openFirst, startTarget } from "../../src/lib/navi";
import { DUMMY_LOCATION, estimateRoundTripMinutes } from "../../src/lib/recommend";
import { RouteSketch, STATIC_ROUTE_ONLY } from "../../src/ui/RouteSketch";
import { buttons, colors, lightMapStyle, space } from "../../src/ui/theme";

// 코스 상세: 투명 헤더(뒤로만) → 지도(경로선이 있을 때만) → 코스명·시간·구간·출처 → 길찾기 / 경로 남기기.
// Android Expo Go에서는 지도 대신 정적 경로 그림.

const MAP_HEIGHT_RATIO = 0.47; // 화면 높이의 45~50%
const MAP_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
const HEADER_HEIGHT = 44; // 투명 헤더 아래로 글이 들어가지 않게

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

// 좌표 목록을 모두 담는 지도 영역 (fitToCoordinates 전 첫 화면용)
function regionFor(points: LatLng[]): Region {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
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
  const { width, height } = useWindowDimensions();
  const mapRef = useRef<MapView>(null);
  const [opening, setOpening] = useState(false);
  // 예상 시간 계산용 내 위치. 권한을 새로 묻지 않고 마지막 위치만 쓴다. 없으면 더미 위치.
  const [here, setHere] = useState<LatLng | undefined>();
  const course = getCourse(id);

  useEffect(() => {
    let alive = true;
    Location.getLastKnownPositionAsync({ maxAge: 300_000 })
      .then((pos) => {
        if (alive && pos) setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {
        // 위치를 못 잡으면 더미 위치 그대로
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!course) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerTransparent: true, title: "" }} />
        <Text style={styles.empty}>코스를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const line = course.polyline;
  const hasMap = line.length > 0;
  const mapHeight = Math.round(height * MAP_HEIGHT_RATIO);
  const start = startOf(course);
  const end = endOf(course);
  // 지도에 담을 점: 경로선 + 시작 + 도착 (내 위치는 넣지 않는다)
  const bounds: LatLng[] = [...line];
  if (start) bounds.push(start);
  if (end) bounds.push(end);

  // "왕복 1시간 · 12.4 km". 시간을 셀 수 없으면 거리만.
  const roundTrip = roundTripLabel(estimateRoundTripMinutes(course, here ?? DUMMY_LOCATION));
  const distance = distanceLabel(course.distance_km);
  const infoText = roundTrip ? `${roundTrip} · ${distance}` : distance;
  const sourceLabel = course.source_name ?? (course.source_url ? "원본 글" : undefined);

  // 내비 앱으로 코스 시작점까지. 기록 화면으로 이동하지 않는다.
  async function openNavi() {
    if (!course || opening) return;
    setOpening(true);
    try {
      const ok = await openFirst(naviUrls(startTarget(course)));
      if (!ok) Alert.alert("길찾기를 열 수 없습니다", "설치된 내비 앱이 없습니다.");
    } finally {
      setOpening(false);
    }
  }

  function openSource() {
    if (!course?.source_url) return;
    Linking.openURL(course.source_url).catch(() => Alert.alert("링크를 열 수 없습니다"));
  }

  function fitMap() {
    if (bounds.length > 1) {
      mapRef.current?.fitToCoordinates(bounds.map(toMap), {
        edgePadding: MAP_PADDING,
        animated: false,
      });
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          title: "",
          headerTintColor: colors.ink,
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      {hasMap ? (
        <View style={{ height: mapHeight }}>
          {STATIC_ROUTE_ONLY ? (
            <RouteSketch points={line} width={width} height={mapHeight} stroke={4} />
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
              onMapReady={fitMap}
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
      ) : null}

      <ScrollView
        style={styles.info}
        contentContainerStyle={[
          styles.infoContent,
          !hasMap && { paddingTop: insets.top + HEADER_HEIGHT + space.screen },
        ]}
      >
        <Text style={styles.name}>{course.name}</Text>
        <Text style={styles.time}>{infoText}</Text>
        <Text style={styles.route}>
          {course.start_name} → {course.end_name}
        </Text>
        {sourceLabel ? (
          <Pressable onPress={openSource} disabled={!course.source_url} hitSlop={8}>
            <Text style={styles.source} numberOfLines={1}>
              출처 · {sourceLabel}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.gap }]}>
        <Pressable
          style={({ pressed }) => [
            buttons.primary,
            pressed && buttons.primaryPressed,
            opening && buttons.primaryDisabled,
          ]}
          onPress={openNavi}
          disabled={opening}
        >
          <Text style={buttons.primaryText}>길찾기</Text>
        </Pressable>
        <Pressable style={buttons.secondary} onPress={() => router.push(`/record/${course.id}`)}>
          <Text style={buttons.secondaryText}>경로 남기기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { fontSize: 15, color: colors.text2 },
  info: { flex: 1 },
  infoContent: { padding: space.screen, gap: 8 },
  name: { fontSize: 26, fontWeight: "700", color: colors.ink },
  time: { fontSize: 16, fontWeight: "600", color: colors.ink },
  route: { fontSize: 15, color: colors.text2 },
  source: { fontSize: 13, color: colors.text2, marginTop: 4 },
  bottom: { paddingHorizontal: space.screen, paddingTop: space.gap, gap: 8 },
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
