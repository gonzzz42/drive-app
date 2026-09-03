import { StyleSheet, Text, View } from "react-native";

export default function AlbumScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>도감</Text>
      <Text style={styles.empty}>아직 완주한 코스가 없습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8, backgroundColor: "#f5f5f7" },
  title: { fontSize: 22, fontWeight: "700", color: "#111" },
  empty: { fontSize: 15, color: "#888" },
});
