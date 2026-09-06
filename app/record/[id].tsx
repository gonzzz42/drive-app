import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { courses } from "../../src/lib/courses";
import { getRecordingSnapshot, startRecording } from "../../src/lib/recording";
import { buttons, colors, space } from "../../src/ui/theme";

// 코스 ID 로 들어오는 옛 진입점 (/record/<코스id>). 기록 화면을 따로 두지 않고
// 공용 세션을 시작한 뒤 /record 로 넘긴다. 이미 진행 중인 세션이 있으면 그 세션으로 간다.

export default function RecordByCourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    async function go() {
      if (getRecordingSnapshot().session) {
        router.replace("/record");
        return;
      }
      // 공개된 코스만 시작할 수 있다
      const course = courses.find((c) => c.id === id);
      if (!course) {
        setMessage("코스를 찾을 수 없습니다.");
        return;
      }
      const result = await startRecording(course.id);
      if (!alive) return;
      if (result.ok || result.reason === "active") router.replace("/record");
      else setMessage(result.message);
    }
    go();
    return () => {
      alive = false;
    };
    // id 가 바뀔 때만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Text style={message ? styles.warn : styles.label}>{message ?? "기록을 시작하는 중…"}</Text>
      </View>
      {message ? (
        <Pressable style={buttons.secondary} onPress={() => router.back()}>
          <Text style={buttons.secondaryText}>뒤로</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.screen, gap: space.gap, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, color: colors.text2, textAlign: "center" },
  warn: { fontSize: 15, color: colors.danger, textAlign: "center" },
});
