import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { courses, type Course, type LatLng } from "../src/lib/courses";
import {
  DUMMY_LOCATION,
  estimateRoundTripMinutes,
  homeCourses,
  reasonFor,
} from "../src/lib/recommend";

// 홈에 그리는 카드 수: 큰 카드 1 + 작은 카드 2
const MAX_CARDS = 3;

function minutesText(minutes: number): string {
  return Number.isFinite(minutes) ? `약 ${minutes}분` : "시간 미정";
}

function BigCard({ course, here }: { course: Course; here: LatLng }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.bigCard, pressed && styles.pressed]}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Text style={styles.bigName}>{course.name}</Text>
      <Text style={styles.bigMinutes}>{minutesText(estimateRoundTripMinutes(course, here))}</Text>
      <Text style={styles.bigReason} numberOfLines={1}>
        {reasonFor(course)}
      </Text>
    </Pressable>
  );
}

function SmallCard({ course, here }: { course: Course; here: LatLng }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Text style={styles.smallName} numberOfLines={1}>
        {course.name}
      </Text>
      <Text style={styles.smallMinutes}>
        {minutesText(estimateRoundTripMinutes(course, here))}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  // 폰 하단 시스템 바(홈 버튼 줄)에 내용이 가려지지 않게 여백을 준다.
  const insets = useSafeAreaInsets();
  // 내 위치. 권한 거부·실패·아직 로딩 중이면 undefined → 더미 위치(서울 강서)를 쓴다.
  const [here, setHere] = useState<LatLng | undefined>();

  // 첫 화면을 그린 뒤에 위치 권한을 요청한다 (useEffect는 첫 그리기 뒤에 실행된다).
  // 처음엔 더미 좌표로 카드를 보여 주고, 허용되면 분·순서만 갱신한다.
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        // 최근 위치가 있으면 바로 쓰고(빠름), 없으면 새로 잡는다
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
  const list = homeCourses(courses, new Date(), base).slice(0, MAX_CARDS);
  const [big, ...small] = list;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/album")} hitSlop={12}>
              <Text style={styles.headerButton}>도감</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 16 + insets.bottom }]}
      >
        {!big ? (
          <Text style={styles.empty}>지금 조건에 맞는 길이 없습니다</Text>
        ) : (
          <>
            <Text style={styles.hint}>{here ? "내 위치 기준" : "대략 강서 기준"}</Text>
            <BigCard course={big} here={base} />
            {small.map((c) => (
              <SmallCard key={c.id} course={c} here={base} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  content: { padding: 16, gap: 12 },
  headerButton: { fontSize: 15, color: "#0a66c2", fontWeight: "600" },
  hint: { fontSize: 13, color: "#888" },
  empty: { fontSize: 15, color: "#888", textAlign: "center", marginTop: 40 },
  pressed: { opacity: 0.7 },
  bigCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 24,
    gap: 6,
  },
  bigName: { color: "#fff", fontSize: 24, fontWeight: "700" },
  bigMinutes: { color: "#fff", fontSize: 40, fontWeight: "700", marginTop: 8 },
  bigReason: { color: "#9ab", fontSize: 14, marginTop: 4 },
  smallCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  smallName: { fontSize: 17, fontWeight: "600", color: "#111", flexShrink: 1 },
  smallMinutes: { fontSize: 15, color: "#555" },
});
