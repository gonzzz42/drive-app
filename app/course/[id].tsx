import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getCourse } from "../../src/lib/courses";

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const course = getCourse(id);

  if (!course) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>코스를 찾을 수 없습니다.</Text>
      </View>
    );
  }

  const distance =
    course.distance_km > 0 ? `${course.distance_km} km` : "거리 미정";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: course.name }} />
      <Text style={styles.name}>{course.name}</Text>
      <Text style={styles.meta}>
        {course.region} · {distance}
      </Text>
      <Text style={styles.meta}>
        {course.start_name} → {course.end_name}
      </Text>
      {course.best_time ? (
        <Text style={styles.meta}>추천 시간: {course.best_time}</Text>
      ) : null}
      {course.avoid_time ? (
        <Text style={styles.meta}>피할 시간: {course.avoid_time}</Text>
      ) : null}
      <Text style={styles.todo}>
        지도와 외부 내비 버튼은 다음 단계에서 추가됩니다.
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push(`/record/${course.id}`)}
      >
        <Text style={styles.buttonText}>기록 시작</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: "#f5f5f7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 22, fontWeight: "700", color: "#111" },
  meta: { fontSize: 15, color: "#555" },
  todo: { fontSize: 13, color: "#999", marginTop: 12 },
  empty: { color: "#888" },
  button: {
    marginTop: "auto",
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
