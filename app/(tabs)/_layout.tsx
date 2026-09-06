import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors, hairline } from "../../src/ui/theme";

// 하단 탭 3개: 드라이브 / 코스 / 내 기록. 아이콘 + 글자. 헤더는 각 화면이 직접 그린다.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text2,
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: hairline,
          borderTopColor: colors.line,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "드라이브",
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: "코스",
          tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "내 기록",
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
