import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { courses, type Course } from "../../src/lib/courses";
import { judgeCompletion } from "../../src/lib/geo";
import { listLocalTrips, type Trip } from "../../src/lib/trips";

// 히스토리 탭. C14에서는 예전 도감 내용을 그대로 옮겨 두었다. C17에서 시간순 기록으로 바꾼다.

type Status = "완주" | "부분 주행" | "미주행";

type Entry = {
  course: Course;
  status: Status;
  tripCount: number;
  latest?: Trip; // 가장 최근 기록
};

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

// 코스별로 기록을 묶어 상태를 정한다. trips는 최근 순으로 정렬돼 있다.
function buildEntries(trips: Trip[]): Entry[] {
  return courses.map((course) => {
    const mine = trips.filter((t) => t.courseId === course.id);
    const completed = mine.some(
      (t) => judgeCompletion(course.polyline, t.points).completed,
    );
    const status: Status =
      mine.length === 0 ? "미주행" : completed ? "완주" : "부분 주행";
    return { course, status, tripCount: mine.length, latest: mine[0] };
  });
}

const STATUS_STYLE: Record<Status, { bg: string; fg: string }> = {
  완주: { bg: "#1a7f37", fg: "#fff" },
  "부분 주행": { bg: "#e0a800", fg: "#111" },
  미주행: { bg: "#ddd", fg: "#666" },
};

function HistoryItem({ entry }: { entry: Entry }) {
  const router = useRouter();
  const color = STATUS_STYLE[entry.status];
  const canOpen = entry.latest != null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && canOpen && styles.cardPressed]}
      disabled={!canOpen}
      onPress={() => {
        if (entry.latest) router.push(`/result/${entry.latest.id}`);
      }}
    >
      <View style={styles.cardTop}>
        <Text style={styles.name}>{entry.course.name}</Text>
        <Text style={[styles.badge, { backgroundColor: color.bg, color: color.fg }]}>
          {entry.status}
        </Text>
      </View>
      <Text style={styles.meta}>{entry.course.region}</Text>
      {entry.latest ? (
        <Text style={styles.meta}>
          기록 {entry.tripCount}회 · 최근 {formatDate(entry.latest.startedAt)}
        </Text>
      ) : (
        <Text style={styles.meta}>아직 기록이 없습니다</Text>
      )}
    </Pressable>
  );
}

export default function HistoryScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 탭이 보일 때마다 다시 읽는다 (결과 화면에서 돌아와도 최신 상태)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listLocalTrips().then((trips) => {
        if (!alive) return;
        setEntries(buildEntries(trips));
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const doneCount = entries.filter((e) => e.status === "완주").length;

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.course.id}
        renderItem={({ item }) => <HistoryItem entry={item} />}
        ListHeaderComponent={
          <Text style={styles.hint}>
            {loaded ? `완주 ${doneCount} / 전체 ${entries.length}` : "불러오는 중..."}
          </Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  list: { padding: 16, gap: 12 },
  hint: { fontSize: 13, color: "#888" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: "700", color: "#111", flexShrink: 1 },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  meta: { fontSize: 14, color: "#555" },
});
