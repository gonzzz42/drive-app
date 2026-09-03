import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse } from "../../src/lib/courses";
import { loadTrip, type Trip } from "../../src/lib/trips";

export default function ResultScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  // 폰 하단 시스템 바(홈 버튼 줄)에 버튼이 가려지지 않게 여백을 준다.
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadTrip(tripId).then((t) => {
      setTrip(t);
      setLoaded(true);
    });
  }, [tripId]);

  const course = getCourse(trip?.courseId);
  const minutes = trip ? Math.round((trip.endedAt - trip.startedAt) / 60000) : 0;

  return (
    <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
      <Text style={styles.title}>주행 결과</Text>
      {!loaded ? (
        <Text style={styles.meta}>불러오는 중...</Text>
      ) : trip ? (
        <>
          <Text style={styles.meta}>{course?.name ?? "알 수 없는 코스"}</Text>
          <Text style={styles.meta}>
            {minutes}분 · 기록한 위치 {trip.points.length}개
          </Text>
        </>
      ) : (
        <Text style={styles.meta}>기록을 찾을 수 없습니다.</Text>
      )}
      <Text style={styles.todo}>결과 카드는 다음 단계에서 추가됩니다.</Text>

      <Pressable style={styles.button} onPress={() => router.replace("/")}>
        <Text style={styles.buttonText}>홈으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: "#f5f5f7" },
  title: { fontSize: 22, fontWeight: "700", color: "#111" },
  meta: { fontSize: 15, color: "#555" },
  todo: { fontSize: 13, color: "#999", marginTop: 12 },
  button: {
    marginTop: "auto",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
