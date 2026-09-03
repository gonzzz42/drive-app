import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getCourse } from "../../src/lib/courses";

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const course = getCourse(id);

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{course?.name ?? "알 수 없는 코스"}</Text>
      <Text style={styles.todo}>GPS 기록은 다음 단계에서 추가됩니다.</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.replace(`/result/${Date.now()}`)}
      >
        <Text style={styles.buttonText}>종료</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: "#f5f5f7" },
  name: { fontSize: 22, fontWeight: "700", color: "#111" },
  todo: { fontSize: 13, color: "#999", marginTop: 12 },
  button: {
    marginTop: "auto",
    backgroundColor: "#c0392b",
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});
