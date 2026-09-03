// SDK 57의 기본 expo-media-library는 새 API(Next)라 Expo Go에 네이티브 모듈이 없다.
// 사진첩 저장만 필요하므로 예전 API(legacy)를 쓴다.
import * as MediaLibrary from "expo-media-library/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { getCourse } from "../../src/lib/courses";
import { judgeCompletion, pathLengthMeters } from "../../src/lib/geo";
import { supabase } from "../../src/lib/supabase";
import { isNight, loadTrip, saveTrip, uploadTrip, type Trip } from "../../src/lib/trips";

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

type SyncState = "none" | "uploading" | "done" | "failed";

export default function ResultScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  // 폰 하단 시스템 바(홈 버튼 줄)에 버튼이 가려지지 않게 여백을 준다.
  const insets = useSafeAreaInsets();
  // 이미지로 캡처할 카드 View
  const cardRef = useRef<View>(null);

  const [trip, setTrip] = useState<Trip | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<SyncState>("none");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    loadTrip(tripId).then((t) => {
      setTrip(t);
      setLoaded(true);
      if (t?.serverId) setSync("done");
    });
  }, [tripId]);

  const course = getCourse(trip?.courseId);
  const minutes = trip ? Math.round((trip.endedAt - trip.startedAt) / 60000) : 0;
  const km = trip ? (pathLengthMeters(trip.points) / 1000).toFixed(1) : "0.0";
  // 완주 판정: 코스 polyline과 주행 궤적 비교
  const result =
    trip && course ? judgeCompletion(course.polyline, trip.points) : undefined;
  const overlapPercent = result ? Math.round(result.overlap * 100) : 0;

  // 서버(Supabase)에 올린다. 아직 안 올라간 기록만. 실패해도 앱은 계속 동작.
  async function syncToServer(t: Trip) {
    if (!supabase || t.serverId) return;
    setSync("uploading");
    setSyncError("");
    try {
      const serverId = await uploadTrip(t, getCourse(t.courseId));
      const updated = { ...t, serverId };
      await saveTrip(updated);
      setTrip(updated);
      setSync("done");
    } catch (e) {
      setSync("failed");
      setSyncError(e instanceof Error ? e.message : String(e));
    }
  }

  // 기록을 읽자마자 한 번 올린다
  useEffect(() => {
    if (loaded && trip && !trip.serverId) syncToServer(trip);
    // trip.id가 바뀔 때만 (같은 기록을 두 번 올리지 않도록)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, trip?.id]);

  // 카드를 PNG 파일로 만든다. 실패하면 undefined.
  async function captureCard(): Promise<string | undefined> {
    try {
      return await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
    } catch {
      Alert.alert("이미지 만들기 실패", "카드를 이미지로 만들지 못했습니다.");
      return undefined;
    }
  }

  async function saveImage() {
    if (busy) return;
    setBusy(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== "granted") {
        Alert.alert("사진 권한이 필요합니다", "설정에서 사진 저장 권한을 허용해 주세요.");
        return;
      }
      const uri = await captureCard();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("저장 완료", "사진첩에 저장했습니다.");
    } catch {
      Alert.alert("저장 실패", "사진첩에 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function shareImage() {
    if (busy) return;
    setBusy(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("공유 불가", "이 기기에서는 공유를 사용할 수 없습니다.");
        return;
      }
      const uri = await captureCard();
      if (!uri) return;
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch {
      Alert.alert("공유 실패", "공유 창을 열지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const syncText = !supabase
    ? "서버 미설정 (.env 없음) · 폰에만 저장됨"
    : sync === "uploading"
      ? "서버에 저장 중..."
      : sync === "done"
        ? "서버에 저장됨"
        : sync === "failed"
          ? `서버 저장 실패: ${syncError}`
          : "";

  return (
    <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
      {!loaded ? (
        <Text style={styles.meta}>불러오는 중...</Text>
      ) : !trip ? (
        <Text style={styles.meta}>기록을 찾을 수 없습니다.</Text>
      ) : (
        <>
          {/* collapsable={false}: Android에서 캡처하려면 실제 View로 남아 있어야 한다 */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <Text style={styles.cardLabel}>
              {isNight(trip.startedAt) ? "밤 드라이브" : "낮 드라이브"}
            </Text>
            <Text style={styles.cardTitle}>{course?.name ?? "알 수 없는 코스"}</Text>
            <View style={styles.cardRow}>
              <View style={styles.cardStat}>
                <Text style={styles.cardNumber}>{km}</Text>
                <Text style={styles.cardUnit}>km</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardNumber}>{minutes}</Text>
                <Text style={styles.cardUnit}>분</Text>
              </View>
            </View>
            <Text style={result?.completed ? styles.cardDone : styles.cardNotDone}>
              {result?.completed ? "완주" : "미완주"}
            </Text>
            <Text style={styles.cardDate}>{formatDate(trip.startedAt)}</Text>
          </View>

          {result ? (
            <Text style={styles.detail}>
              코스 겹침 {overlapPercent}% · 기록한 위치 {trip.points.length}개
              {result.startOk ? "" : " · 시작점 벗어남"}
              {result.endOk ? "" : " · 끝점 벗어남"}
            </Text>
          ) : null}

          <View style={styles.syncRow}>
            <Text style={sync === "failed" ? styles.syncFailed : styles.detail}>
              {syncText}
            </Text>
            {sync === "failed" ? (
              <Pressable onPress={() => syncToServer(trip)}>
                <Text style={styles.retry}>다시 시도</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.subButton, busy && styles.disabled]}
              onPress={saveImage}
              disabled={busy}
            >
              <Text style={styles.subButtonText}>이미지 저장</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.subButton, busy && styles.disabled]}
              onPress={shareImage}
              disabled={busy}
            >
              <Text style={styles.subButtonText}>공유</Text>
            </Pressable>
          </View>
        </>
      )}

      <Pressable style={[styles.button, styles.homeButton]} onPress={() => router.replace("/")}>
        <Text style={styles.homeButtonText}>홈으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f5f5f7" },
  meta: { fontSize: 15, color: "#555" },
  card: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 24,
    gap: 6,
  },
  cardLabel: { color: "#9ab", fontSize: 14, fontWeight: "600" },
  cardTitle: { color: "#fff", fontSize: 24, fontWeight: "700", marginBottom: 12 },
  cardRow: { flexDirection: "row", gap: 32 },
  cardStat: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  cardNumber: { color: "#fff", fontSize: 44, fontWeight: "700" },
  cardUnit: { color: "#9ab", fontSize: 16, marginBottom: 8 },
  cardDone: { color: "#4cd964", fontSize: 20, fontWeight: "700", marginTop: 8 },
  cardNotDone: { color: "#ff6b6b", fontSize: 20, fontWeight: "700", marginTop: 8 },
  cardDate: { color: "#9ab", fontSize: 13, marginTop: 8 },
  detail: { fontSize: 13, color: "#777" },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  syncFailed: { fontSize: 13, color: "#c0392b", flexShrink: 1 },
  retry: { fontSize: 13, color: "#0a66c2", fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  subButton: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ccc" },
  subButtonText: { color: "#111", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.5 },
  homeButton: { marginTop: "auto", backgroundColor: "#111", paddingVertical: 16 },
  homeButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
