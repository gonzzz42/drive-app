import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

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
        <Stack.Screen name="index" options={{ title: "지금 탈 만한 길" }} />
        <Stack.Screen name="course/[id]" options={{ title: "코스 상세" }} />
        <Stack.Screen name="record/[id]" options={{ title: "기록 중" }} />
        <Stack.Screen name="result/[tripId]" options={{ title: "결과" }} />
        <Stack.Screen name="album" options={{ title: "도감" }} />
      </Stack>
    </>
  );
}
