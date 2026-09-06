// SDK 57의 기본 expo-media-library는 새 API(Next)라 Expo Go에 네이티브 모듈이 없다.
// 사진첩 저장만 필요하므로 예전 API(legacy)를 쓴다.
import * as MediaLibrary from "expo-media-library/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { getCourse } from "../../src/lib/courses";
import { dateLabel, distanceLabel, durationLabel } from "../../src/lib/format";
import { judgeCompletion, segmentsLengthMeters, splitSegments } from "../../src/lib/geo";
import { supabase } from "../../src/lib/supabase";
import {
  isNight,
  loadTrip,
  saveTrip,
  tripKind,
  tripTitle,
  uploadTrip,
  type Trip,
} from "../../src/lib/trips";
import { RouteSketch } from "../../src/ui/RouteSketch";
import { buttons, colors, hairline, radius, space } from "../../src/ui/theme";

// 결과 화면: 캡처용 카드(밤/낮 → 경로 그림 → 이름 → 거리·시간 → 날짜·완주) + 저장/공유 + 홈으로.
// 그림은 실제 기록 좌표만 그린다. 자유 드라이브는 완주/미완주를 판정하지 않는다.
// 서버 업로드는 조용히 한 번 시도하고 화면에 표시하지 않는다. 로컬 저장은 서버와 무관하다.

const CARD_RADIUS = 20;
const CARD_PADDING = 24;

export default function ResultScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // 이미지로 캡처할 카드 View
  const cardRef = useRef<View>(null);

  const [trip, setTrip] = useState<Trip | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadTrip(tripId).then((t) => {
      setTrip(t);
      setLoaded(true);
    });
  }, [tripId]);

  // 코스 주행일 때만 코스를 찾는다. 자유 드라이브는 코스가 없다.
  const kind = trip ? tripKind(trip) : "unknown";
  const course = trip && kind === "course" && trip.courseId ? getCourse(trip.courseId) : undefined;
  // 끊긴 자리로 나눈 실제 기록 좌표. 거리도 끊긴 자리를 빼고 잰다.
  const segments = trip ? splitSegments(trip.points) : [];
  const distanceKm = segmentsLengthMeters(segments) / 1000;
  // 완주 판정: 코스 주행에서 코스를 찾았을 때만
  const result = trip && course ? judgeCompletion(course.polyline, segments) : undefined;
  const title = trip ? tripTitle(trip, course?.name) : "";

  // 카드 비율 4:5. 화면 좌우 여백 20.
  const cardWidth = width - space.screen * 2;
  const cardHeight = Math.round(cardWidth * 1.25);
  const sketchWidth = cardWidth - CARD_PADDING * 2;
  const sketchHeight = Math.round(cardHeight * 0.5);

  // 서버(Supabase)에 올린다. 아직 안 올라간 기록에 한해 시도하고, 실패해도 조용히 넘어간다.
  async function syncToServer(t: Trip) {
    if (!supabase || t.serverId) return;
    try {
      const serverId = await uploadTrip(t, course);
      const updated = { ...t, serverId };
      await saveTrip(updated);
      setTrip(updated);
    } catch {
      // 다음에 결과 화면을 열면 다시 시도한다
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.gap }]}
    >
      {!loaded ? (
        <Text style={styles.meta}>불러오는 중…</Text>
      ) : !trip ? (
        <Text style={styles.meta}>기록을 찾을 수 없습니다.</Text>
      ) : (
        <>
          {/* collapsable={false}: Android에서 캡처하려면 실제 View로 남아 있어야 한다 */}
          <View
            ref={cardRef}
            collapsable={false}
            style={[styles.card, { width: cardWidth, height: cardHeight }]}
          >
            <Text style={styles.cardLabel}>
              {isNight(trip.startedAt) ? "밤 드라이브" : "낮 드라이브"}
            </Text>
            <RouteSketch segments={segments} width={sketchWidth} height={sketchHeight} stroke={4} />
            {trip.points.length === 0 ? (
              <Text style={styles.cardDate}>기록된 위치가 없습니다</Text>
            ) : null}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title}
            </Text>
            <Text style={styles.cardStat}>
              {distanceLabel(distanceKm)} · {durationLabel(trip.endedAt - trip.startedAt)}
            </Text>
            <View style={styles.cardFoot}>
              <Text style={styles.cardDate}>{dateLabel(trip.startedAt, "dotted")}</Text>
              {result ? (
                <Text style={styles.cardDate}>{result.completed ? "완주" : "미완주"}</Text>
              ) : null}
              {segments.length > 1 ? (
                <Text style={styles.cardDate}>끊긴 구간 {segments.length - 1}곳</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.row}>
            <Pressable
              style={[styles.smallButton, styles.saveButton, busy && buttons.primaryDisabled]}
              onPress={saveImage}
              disabled={busy}
            >
              <Text style={styles.saveText}>저장</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.smallButton,
                styles.shareButton,
                pressed && buttons.primaryPressed,
                busy && buttons.primaryDisabled,
              ]}
              onPress={shareImage}
              disabled={busy}
            >
              <Text style={buttons.primaryText}>공유</Text>
            </Pressable>
          </View>
        </>
      )}

      <Pressable style={[buttons.secondary, styles.home]} onPress={() => router.replace("/")}>
        <Text style={buttons.secondaryText}>홈으로</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, padding: space.screen, gap: space.gap },
  meta: { fontSize: 15, color: colors.text2 },
  card: {
    backgroundColor: colors.bg,
    borderRadius: CARD_RADIUS,
    borderWidth: hairline,
    borderColor: colors.line,
    padding: CARD_PADDING,
    gap: space.gap,
  },
  cardLabel: { fontSize: 14, color: colors.text2 },
  cardTitle: { fontSize: 28, fontWeight: "700", color: colors.ink },
  cardStat: { fontSize: 20, fontWeight: "600", color: colors.ink },
  cardFoot: { flexDirection: "row", gap: space.gap, marginTop: "auto" },
  cardDate: { fontSize: 14, color: colors.text2 },
  row: { flexDirection: "row", gap: space.gap },
  smallButton: {
    flex: 1,
    height: 48,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: { borderWidth: hairline, borderColor: colors.line },
  saveText: { color: colors.ink, fontSize: 17, fontWeight: "600" },
  shareButton: { backgroundColor: colors.accent },
  home: { marginTop: "auto" },
});
