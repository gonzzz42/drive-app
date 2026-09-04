import { StyleSheet, Text, View } from "react-native";

// 추천 탭 뼈대. C16에서 가로 카드 5장 + 더보기로 채운다.
export default function BrowseScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.todo}>추천 화면은 다음 단계에서 채웁니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f5f5f7" },
  todo: { fontSize: 13, color: "#999", textAlign: "center", marginTop: 40 },
});
