import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Polyline, type LatLng as MapLatLng, type Region } from "react-native-maps";
import { getCourse } from "../../src/lib/courses";
import { pathLengthMeters } from "../../src/lib/geo";
import { listLocalTrips, type Trip } from "../../src/lib/trips";

// 히스토리 탭: 폰에 저장된 기록을 시간순(최신 위)으로. 레벨·완주율·미주행 목록 없음.

// Android Expo Go는 지도가 검게 나오므로 작은 궤적 지도는 iOS에서만 그린다.
// (Android 개발 빌드에서 지도가 보이면 이 조건을 지우면 된다)
const SHOW_MINI_MAP = Platform.OS === "ios";

type Row = {
  trip: Trip;
  name: string;
  km: string;
  minutes: number;
  count: number; // 같은 코스를 탄 횟수
};

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

function buildRows(trips: Trip[]): Row[] {
  const countByCourse = new Map<string, number>();
  for (const t of trips) {
    countByCourse.set(t.courseId, (countByCourse.get(t.courseId) ?? 0) + 1);
  }
  return trips.map((trip) => ({
    trip,
    name: getCourse(trip.courseId)?.name ?? "알 수 없는 코스",
    km: (pathLengthMeters(trip.points) / 1000).toFixed(1),
    minutes: Math.round((trip.endedAt - trip.startedAt) / 60000),
    count: countByCourse.get(trip.courseId) ?? 1,
  }));
}

// 궤적 전체가 들어오는 작은 지도 영역
function regionFor(points: MapLatLng[]): Region {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
}

function MiniMap({ trip }: { trip: Trip }) {
  const points = trip.points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  if (!SHOW_MINI_MAP || points.length < 2) return null;
  return (
    <View style={styles.miniMap} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(points)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        liteMode
      >
        <Polyline coordinates={points} strokeWidth={3} strokeColor="#0a66c2" />
      </MapView>
    </View>
  );
}

function HistoryRow({ row }: { row: Row }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(`/result/${row.trip.id}`)}
    >
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {row.name}
          </Text>
          {row.count >= 2 ? <Text style={styles.count}>{row.count}회</Text> : null}
        </View>
        <Text style={styles.meta}>
          {row.km} km · {row.minutes}분 · {formatDate(row.trip.startedAt)}
        </Text>
      </View>
      <MiniMap trip={row.trip} />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 탭이 보일 때마다 다시 읽는다 (결과 화면에서 돌아와도 최신 상태)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listLocalTrips().then((trips) => {
        if (!alive) return;
        setRows(buildRows(trips));
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.trip.id}
        renderItem={({ item }) => <HistoryRow row={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded ? <Text style={styles.empty}>아직 탄 길이 없습니다</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { fontSize: 15, color: "#888", textAlign: "center", marginTop: 40 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, gap: 4 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 17, fontWeight: "700", color: "#111", flexShrink: 1 },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  meta: { fontSize: 14, color: "#555" },
  miniMap: { width: 72, height: 72, borderRadius: 8, overflow: "hidden" },
});
