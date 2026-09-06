import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCourse } from "../../src/lib/courses";
import { distanceLabel } from "../../src/lib/format";
import { segmentsLengthMeters, splitSegments } from "../../src/lib/geo";
import {
  finishRecording,
  refreshRecording,
  resumeRecording,
  useRecording,
} from "../../src/lib/recording";
import { collectorStatus } from "../../src/lib/recordingCore";
import { buttons, colors, space } from "../../src/ui/theme";

// 기록 화면: 진행 중인 세션을 읽고 조작만 한다. 위치 수집은 이 화면의 수명과 무관하게 돈다.
// 상태 → 코스명(또는 자유 드라이브) → 거리 · 경과 시간 · 수집 상태 → 종료.
// 화면을 나가도 기록은 끝나지 않는다. 다시 들어오면 같은 세션이 보인다.
// 헤더 옵션은 app/_layout.tsx 에 고정한다. 여기서 헤더를 바꾸면 결과 화면으로 넘어가는 순간
// 사라지는 화면의 헤더를 갱신하다가 Android(react-native-screens)가 죽는다.

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export default function RecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, points, collectorRunning, lastError, finishError } = useRecording();
  const [now, setNow] = useState(Date.now());
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false); // 저장을 마치고 결과로 넘어가는 중
  const [resuming, setResuming] = useState(false);

  // 1초마다 경과 시간·수신 상태 갱신
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 화면으로 돌아올 때 파일의 좌표와 수집기 상태를 다시 읽는다
  useFocusEffect(
    useCallback(() => {
      refreshRecording();
    }, []),
  );

  function goHome() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function onFinish() {
    if (finishing || finished) return;
    setFinishing(true);
    const result = await finishRecording();
    if (result.ok) {
      setFinished(true);
      router.replace(`/result/${result.tripId}`);
      return;
    }
    setFinishing(false);
    if (result.reason === "none") goHome();
    // 그 밖의 실패는 finishError 로 화면에 남고, 같은 기록 ID 로 다시 시도한다
  }

  async function onResume() {
    if (resuming) return;
    setResuming(true);
    const result = await resumeRecording();
    setResuming(false);
    if (!result.ok) Alert.alert("이어서 기록할 수 없습니다", result.message);
  }

  if (finished) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.label}>저장했습니다</Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom + space.gap }]}>
        <View style={styles.center}>
          <Text style={styles.label}>진행 중인 기록이 없습니다</Text>
        </View>
        <Pressable style={buttons.secondary} onPress={goHome}>
          <Text style={buttons.secondaryText}>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  const course = session.courseId ? getCourse(session.courseId) : undefined;
  const title = session.kind === "free" ? "자유 드라이브" : (course?.name ?? "코스 정보 없음");
  const stopping = session.status === "stopping";
  const endAt = stopping ? (session.stoppedAt ?? now) : now;
  const elapsed = Math.max(0, endAt - session.startedAt);
  const segments = splitSegments(points);
  const distanceKm = segmentsLengthMeters(segments) / 1000;
  const lastPointT = points.length > 0 ? points[points.length - 1].t : undefined;
  const status = collectorStatus(collectorRunning, lastPointT, now);

  // 수집 상태 한 줄. 실패를 '기록 중'으로 숨기지 않는다.
  let statusText = "";
  let statusDanger = false;
  if (stopping) {
    statusText = "종료 처리 중";
  } else if (status === "stopped") {
    statusText = "위치 수집이 멈춰 있습니다. 이어서 기록하거나 종료하세요.";
    statusDanger = true;
  } else if (status === "waiting") {
    statusText = "위치 찾는 중…";
  } else if (status === "stale") {
    const sec = lastPointT != null ? Math.round((now - lastPointT) / 1000) : 0;
    statusText = `위치 신호 없음 · ${sec}초 전`;
    statusDanger = true;
  } else {
    statusText = "위치 수신 중";
  }

  const buttonLabel = finishing ? "종료 처리 중…" : stopping ? "종료 다시 시도" : "종료";

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + space.gap }]}>
      <Text style={styles.state}>{stopping ? "종료 처리 중" : "기록 중"}</Text>
      <Text style={styles.name} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.center}>
        <Text style={styles.label}>거리</Text>
        <Text style={styles.distance}>{distanceLabel(distanceKm)}</Text>
        <Text style={[styles.label, styles.labelGap]}>경과 시간</Text>
        <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>

        <Text style={[styles.status, statusDanger && styles.warn]}>{statusText}</Text>
        {lastError && !stopping ? <Text style={styles.warn}>{lastError}</Text> : null}
        {session.collector === "foreground" && !stopping ? (
          <Text style={styles.note}>지금은 앱을 열어둔 동안만 기록됩니다</Text>
        ) : null}
        {segments.length > 1 ? <Text style={styles.note}>끊긴 구간 {segments.length - 1}곳</Text> : null}

        {status === "stopped" && !stopping ? (
          <Pressable style={buttons.secondary} onPress={onResume} disabled={resuming}>
            <Text style={buttons.secondaryText}>{resuming ? "다시 시작하는 중…" : "이어서 기록"}</Text>
          </Pressable>
        ) : null}
      </View>

      {finishError ? <Text style={styles.warn}>{finishError}</Text> : null}
      <Pressable
        style={({ pressed }) => [
          buttons.primary,
          pressed && buttons.primaryPressed,
          finishing && buttons.primaryDisabled,
        ]}
        onPress={onFinish}
        disabled={finishing}
      >
        <Text style={buttons.primaryText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.screen, gap: space.gap, backgroundColor: colors.bg },
  state: { fontSize: 14, color: colors.text2, textAlign: "center" },
  name: { fontSize: 18, fontWeight: "600", color: colors.ink, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontSize: 14, color: colors.text2 },
  labelGap: { marginTop: 24 },
  distance: {
    fontSize: 56,
    fontWeight: "700",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  elapsed: {
    fontSize: 32,
    fontWeight: "600",
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  status: { fontSize: 14, color: colors.text2, textAlign: "center", marginTop: 24 },
  note: { fontSize: 13, color: colors.text2, textAlign: "center" },
  warn: { fontSize: 14, color: colors.danger, textAlign: "center" },
});
