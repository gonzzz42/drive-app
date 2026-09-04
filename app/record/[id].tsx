import * as Location from "expo-location";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse } from "../../src/lib/courses";
import { saveTrip, type TripPoint } from "../../src/lib/trips";
import { buttons, colors, space } from "../../src/ui/theme";

// 기록 화면: 코스명 → 기록 중 · 경과 시간 → 종료. 포그라운드에서만 좌표를 쌓는다.

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
  const insets = useSafeAreaInsets();
  const course = getCourse(id);

  // 화면을 다시 그려도 값이 유지돼야 하는 것들은 ref에 둔다.
  const startedAt = useRef(Date.now());
  const points = useRef<TripPoint[]>([]);
  const lastSavedAt = useRef(0);

  const [elapsedMs, setElapsedMs] = useState(0);
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
    <View style={[styles.container, { paddingBottom: insets.bottom + space.gap }]}>
      <Stack.Screen
        options={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
        }}
      />
      <Text style={styles.name} numberOfLines={1}>
        {course?.name ?? "알 수 없는 코스"}
      </Text>

      <View style={styles.center}>
        <Text style={styles.label}>기록 중</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>
        {permissionDenied ? (
          <Text style={styles.warn}>
            위치 권한이 없어 기록할 수 없습니다. 설정에서 위치 권한을 허용해 주세요.
          </Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          buttons.primary,
          pressed && buttons.primaryPressed,
          saving && buttons.primaryDisabled,
        ]}
        onPress={finish}
        disabled={saving}
      >
        <Text style={buttons.primaryText}>{saving ? "저장 중…" : "종료"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.screen, gap: space.gap, backgroundColor: colors.bg },
  name: { fontSize: 18, fontWeight: "600", color: colors.ink, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  label: { fontSize: 14, color: colors.text2 },
  elapsed: {
    fontSize: 64,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  warn: { fontSize: 14, color: colors.danger, textAlign: "center", marginTop: 16 },
});
