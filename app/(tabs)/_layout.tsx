import { Tabs } from "expo-router";

// 하단 탭 3개: 시작 / 추천 / 히스토리 (아이콘 없이 라벨만)
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#111",
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "시작" }} />
      <Tabs.Screen name="browse" options={{ title: "추천" }} />
      <Tabs.Screen name="history" options={{ title: "히스토리" }} />
    </Tabs>
  );
}
