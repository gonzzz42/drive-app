import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { courses, type Course, type LatLng } from "../../src/lib/courses";
import { distanceLabel, roundTripLabel } from "../../src/lib/format";
import {
  DUMMY_LOCATION,
  estimateRoundTripMinutes,
  recommendCourses,
} from "../../src/lib/recommend";
import { RouteSketch } from "../../src/ui/RouteSketch";
import { colors, hairline, radius, space } from "../../src/ui/theme";

// 코스 탭: 제목 → 가로 카드(최대 5, 위 경로 그림 + 아래 코스명·구간·왕복 시간) → 전체 코스 행.
// 검색·필터 없음. 지도 타일 없음(모두 RouteSketch).

const MAX_SHELF = 5;
const CARD_WIDTH_RATIO = 0.78; // 다음 카드가 조금 보이게
const THUMB = 56;

// 예상 시간. 셀 수 없으면 거리, 거리도 없으면 빈 문자열.
function timeText(course: Course, here: LatLng): string {
  const roundTrip = roundTripLabel(estimateRoundTripMinutes(course, here));
  if (roundTrip) return roundTrip;
  return course.distance_km > 0 ? distanceLabel(course.distance_km) : "";
}

// 그림용 점: 경로선. 없으면 시작·도착 좌표만.
function sketchPoints(c: Course): LatLng[] {
  if (c.polyline.length > 0) return c.polyline;
  const pts: LatLng[] = [];
  if (c.start_lat != null && c.start_lng != null) pts.push({ lat: c.start_lat, lng: c.start_lng });
  if (c.end_lat != null && c.end_lng != null) pts.push({ lat: c.end_lat, lng: c.end_lng });
  return pts;
}

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.round(width * CARD_WIDTH_RATIO);
  const sketchHeight = Math.round(cardWidth * 0.6);

  // 내 위치. 없으면 더미 위치(서울 강서)로 시간을 센다.
  const [here, setHere] = useState<LatLng | undefined>();
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
  const shelf = recommendCourses(courses, new Date(), base).slice(0, MAX_SHELF);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.screen }]}
    >
      <Text style={styles.title}>코스</Text>

      {shelf.length === 0 ? (
        <Text style={styles.empty}>코스가 없습니다</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + space.gap}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.shelf}
        >
          {shelf.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [styles.card, { width: cardWidth }, pressed && styles.pressed]}
              onPress={() => router.push(`/course/${c.id}`)}
            >
              <RouteSketch points={sketchPoints(c)} width={cardWidth} height={sketchHeight} />
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.cardRoute} numberOfLines={1}>
                  {c.start_name} → {c.end_name}
                </Text>
                <Text style={styles.cardTime}>{timeText(c, base)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={styles.sectionTitle}>전체 코스</Text>
      <View>
        {courses.map((c, i) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.row, i > 0 && styles.rowLine, pressed && styles.pressed]}
            onPress={() => router.push(`/course/${c.id}`)}
          >
            <RouteSketch points={sketchPoints(c)} width={THUMB} height={THUMB} radius={radius.thumb} />
            <View style={styles.rowText}>
              <Text style={styles.rowName} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.rowRoute} numberOfLines={1}>
                {c.start_name} → {c.end_name}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.text2} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: space.screen, gap: space.gap },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, paddingHorizontal: space.screen },
  empty: { fontSize: 15, color: colors.text2, paddingHorizontal: space.screen },
  shelf: { paddingHorizontal: space.screen, gap: space.gap },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: hairline,
    borderColor: colors.line,
    overflow: "hidden",
  },
  pressed: { opacity: 0.85 },
  cardBody: { padding: 16, gap: 4 },
  cardName: { fontSize: 18, fontWeight: "700", color: colors.ink },
  cardRoute: { fontSize: 14, color: colors.text2 },
  cardTime: { fontSize: 16, fontWeight: "600", color: colors.ink, marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
    paddingHorizontal: space.screen,
    marginTop: space.gap,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.gap,
    paddingHorizontal: space.screen,
    paddingVertical: space.gap,
  },
  rowLine: { borderTopWidth: hairline, borderTopColor: colors.line },
  rowText: { flex: 1, gap: 2 },
  rowName: { fontSize: 16, fontWeight: "600", color: colors.ink },
  rowRoute: { fontSize: 13, color: colors.text2 },
});
