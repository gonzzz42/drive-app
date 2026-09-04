import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng as MapLatLng,
  type Region,
} from "react-native-maps";
import { courses, type Course, type LatLng } from "../../src/lib/courses";
import { naviUrls, openFirst, startTarget } from "../../src/lib/navi";
import {
  DUMMY_LOCATION,
  estimateRoundTripMinutes,
  pickTodayCourse,
  reasonFor,
} from "../../src/lib/recommend";

// 시작 탭: 오늘 길 1개 + 지도 + "이 길로 출발"(내비만). 기록은 자동으로 켜지 않는다.

// 기본 좌표: 서울 시청
const SEOUL: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};

const MAP_PADDING = { top: 60, right: 40, bottom: 40, left: 40 };

function toMap(p: LatLng): MapLatLng {
  return { latitude: p.lat, longitude: p.lng };
}

// 코스 시작 핀 좌표. 오늘 길은 시작 좌표가 있는 코스만 고르므로 보통 있다.
function startPinOf(course: Course): MapLatLng | undefined {
  if (course.start_lat != null && course.start_lng != null) {
    return { latitude: course.start_lat, longitude: course.start_lng };
  }
  return course.polyline.length > 0 ? toMap(course.polyline[0]) : undefined;
}

// 좌표 목록을 모두 담는 지도 영역 (첫 화면용)
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
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
  };
}

export default function StartScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [opening, setOpening] = useState(false);
  // 내 위치. 권한 거부·실패·아직 로딩 중이면 undefined → 더미 위치(서울 강서)로 고른다.
  const [here, setHere] = useState<LatLng | undefined>();

  // 첫 화면을 그린 뒤에 위치 권한을 요청한다. 허용되면 오늘 길·분·지도를 갱신한다.
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
  const line = pick ? pick.polyline.map(toMap) : [];
  const startPin = pick ? startPinOf(pick) : undefined;

  // 지도에 코스 선 + 시작 핀 + (있으면) 내 위치가 다 들어오게 맞춘다
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const pts: MapLatLng[] = [...line];
    if (startPin) pts.push(startPin);
    if (here) pts.push(toMap(here));
    if (pts.length >= 2) {
      mapRef.current.fitToCoordinates(pts, { edgePadding: MAP_PADDING, animated: false });
    } else if (pts.length === 1) {
      mapRef.current.animateToRegion({ ...pts[0], latitudeDelta: 0.05, longitudeDelta: 0.05 }, 0);
    }
    // pick과 here가 바뀔 때만 다시 맞춘다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, pick?.id, here?.lat, here?.lng]);

  // 티맵을 먼저, 없으면 카카오맵. 목적지는 코스 시작점. 기록 화면으로 이동하지 않는다.
  async function openNavi() {
    if (!pick || opening) return;
    setOpening(true);
    try {
      const ok = await openFirst(naviUrls(startTarget(pick)));
      if (!ok) {
        Alert.alert("내비를 열 수 없습니다", "티맵, 카카오맵, 브라우저를 모두 열지 못했습니다.");
      }
    } finally {
      setOpening(false);
    }
  }

  function goBrowse() {
    router.navigate("/browse");
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={regionFor(startPin ? [...line, startPin] : line)}
        showsUserLocation={here != null}
        onMapReady={() => setMapReady(true)}
      >
        {line.length > 1 ? (
          <Polyline coordinates={line} strokeWidth={4} strokeColor="#0a66c2" />
        ) : null}
        {startPin && pick ? <Marker coordinate={startPin} title={pick.start_name} /> : null}
      </MapView>

      <View style={styles.panel}>
        {pick ? (
          <View style={styles.card}>
            <Text style={styles.cardName}>{pick.name}</Text>
            <Text style={styles.cardLine} numberOfLines={1}>
              약 {estimateRoundTripMinutes(pick, base)}분 · {reasonFor(pick)}
            </Text>
            <Text style={styles.hint}>{here ? "내 위치 기준" : "대략 강서 기준"}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardName}>추천에서 길을 고르세요</Text>
            <Pressable onPress={goBrowse} hitSlop={8}>
              <Text style={styles.link}>추천 탭으로 가기</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.notice}>인증 카드를 남기려면 출발 전에 기록을 켜 두세요.</Text>
        <Pressable
          style={[styles.primary, (!pick || opening) && styles.disabled]}
          onPress={openNavi}
          disabled={!pick || opening}
        >
          <Text style={styles.primaryText}>이 길로 출발</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable
            onPress={() => pick && router.push(`/record/${pick.id}`)}
            disabled={!pick}
            hitSlop={8}
          >
            <Text style={[styles.textButton, !pick && styles.textDisabled]}>기록만 시작</Text>
          </Pressable>
          <Pressable onPress={goBrowse} hitSlop={8}>
            <Text style={styles.link}>다른 길 보기</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  map: { flex: 1 },
  panel: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardName: { fontSize: 20, fontWeight: "700", color: "#111" },
  cardLine: { fontSize: 14, color: "#555" },
  hint: { fontSize: 12, color: "#999" },
  notice: { fontSize: 13, color: "#666", textAlign: "center" },
  primary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  disabled: { opacity: 0.4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 },
  textButton: { color: "#888", fontSize: 15, fontWeight: "600" },
  textDisabled: { color: "#bbb" },
  link: { color: "#0a66c2", fontSize: 15, fontWeight: "600" },
});
