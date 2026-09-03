import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse } from "../../src/lib/courses";
import { saveTrip, type TripPoint } from "../../src/lib/trips";

// 좌표를 저장하는 간격
const SAVE_INTERVAL_MS = 3000;

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // 폰 하단 시스템 바(홈 버튼 줄)에 버튼이 가려지지 않게 여백을 준다.
  const insets = useSafeAreaInsets();
  const course = getCourse(id);

  // 화면을 다시 그려도 값이 유지돼야 하는 것들은 ref에 둔다.
  const startedAt = useRef(Date.now());
  const points = useRef<TripPoint[]>([]);
  const lastSavedAt = useRef(0);

  const [elapsedMs, setElapsedMs] = useState(0);
  const [pointCount, setPointCount] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1초마다 경과 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 위치 권한을 받고, 3초마다 좌표를 쌓는다 (포그라운드만).
  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: SAVE_INTERVAL_MS,
          distanceInterval: 0,
        },
        (loc) => {
          // iOS는 timeInterval을 무시하고 더 자주 부르므로 여기서 3초 간격을 지킨다.
          const now = Date.now();
          if (now - lastSavedAt.current < SAVE_INTERVAL_MS - 500) return;
          lastSavedAt.current = now;
          points.current.push({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            t: now,
          });
          setPointCount(points.current.length);
        },
      );
      if (cancelled) subscription.remove();
    }

    start();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  async function finish() {
    if (saving) return;
    setSaving(true);
    const tripId = String(Date.now());
    try {
      await saveTrip({
        id: tripId,
        courseId: course?.id ?? "",
        startedAt: startedAt.current,
        endedAt: Date.now(),
        points: points.current,
      });
    } catch {
      Alert.alert("저장 실패", "기록을 저장하지 못했습니다. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }
    router.replace(`/result/${tripId}`);
  }

  return (
    <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
      <Text style={styles.name}>{course?.name ?? "알 수 없는 코스"}</Text>

      <View style={styles.stats}>
        <Text style={styles.label}>경과 시간</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>
        <Text style={styles.label}>기록한 위치</Text>
        <Text style={styles.count}>{pointCount}개</Text>
      </View>

      {permissionDenied ? (
        <Text style={styles.warn}>
          위치 권한이 없어 기록할 수 없습니다. 설정에서 위치 권한을 허용해 주세요.
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={finish}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? "저장 중..." : "종료"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: "#f5f5f7" },
  name: { fontSize: 18, fontWeight: "600", color: "#555" },
  stats: { alignItems: "center", marginTop: 40, gap: 4 },
  label: { fontSize: 14, color: "#888", marginTop: 16 },
  elapsed: {
    fontSize: 64,
    fontWeight: "700",
    color: "#111",
    fontVariant: ["tabular-nums"],
  },
  count: { fontSize: 32, fontWeight: "700", color: "#111" },
  warn: { fontSize: 14, color: "#c0392b", textAlign: "center", marginTop: 16 },
  button: {
    marginTop: "auto",
    backgroundColor: "#c0392b",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
