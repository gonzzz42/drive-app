import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { courses, type Course } from "../src/lib/courses";

function CourseItem({ course }: { course: Course }) {
  const router = useRouter();
  const distance =
    course.distance_km > 0 ? `${course.distance_km} km` : "거리 미정";

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/course/${course.id}`)}
    >
      <Text style={styles.name}>{course.name}</Text>
      <Text style={styles.meta}>
        {course.region} · {distance}
      </Text>
      <Text style={styles.meta}>
        {course.start_name} → {course.end_name}
      </Text>
      {course.best_time ? (
        <Text style={styles.time}>추천 시간: {course.best_time}</Text>
      ) : null}
      <View style={styles.tags}>
        {course.tags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            #{tag}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  // 폰 하단 시스템 바(홈 버튼 줄)에 버튼이 가려지지 않게 여백을 준다.
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CourseItem course={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>아직 코스가 없습니다.</Text>
        }
      />
      <Pressable
        style={[styles.albumButton, { marginBottom: 16 + insets.bottom }]}
        onPress={() => router.push("/album")}
      >
        <Text style={styles.albumButtonText}>도감 보기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardPressed: { opacity: 0.7 },
  name: { fontSize: 18, fontWeight: "700", color: "#111" },
  meta: { fontSize: 14, color: "#555" },
  time: { fontSize: 13, color: "#0a66c2", marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: {
    fontSize: 12,
    color: "#333",
    backgroundColor: "#eee",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  albumButton: {
    margin: 16,
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  albumButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
