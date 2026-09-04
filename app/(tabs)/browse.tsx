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
import { courses, type Course, type LatLng } from "../../src/lib/courses";
import { distanceMeters } from "../../src/lib/geo";
import {
  DUMMY_LOCATION,
  estimateRoundTripMinutes,
  hasHomeInfo,
  reasonFor,
} from "../../src/lib/recommend";

// 추천 탭: 가로 카드 최대 5장(featured 공식 코스) + 더보기(공식 코스 전체). 검색·필터 없음.

const MAX_SHELF = 5;
const CARD_GAP = 12;

function minutesText(course: Course, here: LatLng): string {
  const m = estimateRoundTripMinutes(course, here);
  return Number.isFinite(m) ? `약 ${m}분` : "시간 미정";
}

// 메인 선반: featured 공식 코스. 하나도 없으면 좌표+거리 있는 공식 코스를 가까운 순으로.
function shelfCourses(all: Course[], here: LatLng): Course[] {
  const official = all.filter((c) => c.is_official);
  const featured = official.filter((c) => c.featured);
  if (featured.length > 0) return featured.slice(0, MAX_SHELF);
  return official
    .filter(hasHomeInfo)
    .sort(
      (a, b) =>
        distanceMeters(here, { lat: a.start_lat!, lng: a.start_lng! }) -
        distanceMeters(here, { lat: b.start_lat!, lng: b.start_lng! }),
    )
    .slice(0, MAX_SHELF);
}

export default function BrowseScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // 다음 카드가 살짝 보이게 카드 폭은 화면의 80%
  const cardWidth = Math.round(width * 0.8);

  // 내 위치. 없으면 더미 위치(서울 강서)로 분을 센다.
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
  const shelf = shelfCourses(courses, base);
  const all = courses.filter((c) => c.is_official);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>{here ? "내 위치 기준" : "대략 강서 기준"}</Text>

      {shelf.length === 0 ? (
        <Text style={styles.empty}>보여줄 코스가 없습니다</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.shelf}
        >
          {shelf.map((c) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed && styles.pressed,
              ]}
              onPress={() => router.push(`/course/${c.id}`)}
            >
              <Text style={styles.cardName} numberOfLines={2}>
                {c.name}
              </Text>
              <Text style={styles.cardMinutes}>{minutesText(c, base)}</Text>
              <Text style={styles.cardReason} numberOfLines={1}>
                {reasonFor(c)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Text style={styles.sectionTitle}>더보기</Text>
      {all.map((c) => (
        <Pressable
          key={c.id}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => router.push(`/course/${c.id}`)}
        >
          <Text style={styles.rowName} numberOfLines={1}>
            {c.name}
          </Text>
          <Text style={styles.rowMinutes}>{minutesText(c, base)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  content: { paddingVertical: 16, gap: 12 },
  hint: { fontSize: 13, color: "#888", paddingHorizontal: 16 },
  empty: { fontSize: 15, color: "#888", textAlign: "center", marginVertical: 24 },
  shelf: { paddingHorizontal: 16, gap: CARD_GAP },
  card: {
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 20,
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  cardName: { color: "#fff", fontSize: 20, fontWeight: "700" },
  cardMinutes: { color: "#fff", fontSize: 28, fontWeight: "700" },
  cardReason: { color: "#9ab", fontSize: 13 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  row: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  rowName: { fontSize: 16, fontWeight: "600", color: "#111", flexShrink: 1 },
  rowMinutes: { fontSize: 14, color: "#555" },
});
