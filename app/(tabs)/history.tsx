import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse } from "../../src/lib/courses";
import { dateLabel, distanceLabel, durationLabel } from "../../src/lib/format";
import { segmentsLengthMeters, splitSegments } from "../../src/lib/geo";
import { listLocalTrips, tripKind, tripTitle, type Trip, type TripPoint } from "../../src/lib/trips";
import { RouteSketch } from "../../src/ui/RouteSketch";
import { colors, hairline, radius, space } from "../../src/ui/theme";

// 내 기록 탭: 폰에 저장된 기록을 최신순으로. 행마다 이름·날짜·거리·시간 + 72px 경로 그림.
// 그림은 실제 기록 좌표만 그린다 (코스 선으로 대신하지 않는다). 끊긴 자리는 비워 둔다.

const THUMB = 72;

type Row = {
  trip: Trip;
  name: string; // 코스명 · 자유 드라이브 · 코스 정보 없음
  meta: string; // "9월 4일 · 12.4 km · 58분"
  segments: TripPoint[][];
};

function buildRows(trips: Trip[]): Row[] {
  return trips.map((trip) => {
    const course = tripKind(trip) === "course" && trip.courseId ? getCourse(trip.courseId) : undefined;
    const segments = splitSegments(trip.points);
    return {
      trip,
      name: tripTitle(trip, course?.name),
      meta: [
        dateLabel(trip.startedAt),
        distanceLabel(segmentsLengthMeters(segments) / 1000),
        durationLabel(trip.endedAt - trip.startedAt),
      ].join(" · "),
      segments,
    };
  });
}

function HistoryRow({ row }: { row: Row }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => router.push(`/result/${row.trip.id}`)}
    >
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.meta}
        </Text>
      </View>
      <RouteSketch segments={row.segments} width={THUMB} height={THUMB} radius={radius.thumb} />
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top + space.screen }]}>
      <Text style={styles.title}>내 기록</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.trip.id}
        renderItem={({ item }) => <HistoryRow row={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded ? <Text style={styles.empty}>아직 기록이 없습니다</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: space.screen,
    marginBottom: space.gap,
  },
  list: { paddingHorizontal: space.screen, paddingBottom: space.screen, flexGrow: 1 },
  empty: { fontSize: 15, color: colors.text2, textAlign: "center", marginTop: 40 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.gap,
    paddingVertical: 16,
  },
  separator: { height: hairline, backgroundColor: colors.line },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 4 },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 14, color: colors.text2 },
});
