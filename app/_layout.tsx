import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// 루트: 탭 묶음 하나 + 탭 밖 화면(코스 상세, 기록, 결과)
export default function RootLayout() {
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
        <Stack.Screen name="record/[id]" options={{ title: "기록 중" }} />
        <Stack.Screen name="result/[tripId]" options={{ title: "결과" }} />
      </Stack>
    </>
  );
}
