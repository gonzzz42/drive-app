import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { initRecording } from "../src/lib/recording";
import { colors } from "../src/ui/theme";

// 루트: 탭 묶음 하나 + 탭 밖 화면(코스 상세, 기록, 결과)
// 백그라운드 위치 작업 정의는 index.ts(앱 시작점)에서 불러온다.
// 기록 화면의 헤더는 여기서 고정한다. 화면 안에서 헤더를 바꾸면 결과로 넘어가는 순간 Android 가 죽는다.

const plainHeader = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.ink,
};
export default function RootLayout() {
  // 앱을 켤 때 저장된 기록 세션이 있으면 수집기가 아직 도는지만 확인한다. 새 기록을 시작하지 않는다.
  useEffect(() => {
    initRecording();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontWeight: "700" },
          headerBackTitle: "뒤로",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="course/[id]" options={{ title: "코스 상세" }} />
        <Stack.Screen name="record/index" options={{ title: "기록", ...plainHeader }} />
        <Stack.Screen name="record/[id]" options={{ title: "기록 시작", ...plainHeader }} />
        <Stack.Screen name="result/[tripId]" options={{ title: "결과", ...plainHeader }} />
      </Stack>
    </>
  );
}
