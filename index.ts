// 앱 시작점. package.json 의 "main" 이 이 파일이다.
// 백그라운드 위치 작업은 화면이 없는 실행에서도 정의돼 있어야 하므로 라우터보다 먼저 불러온다.
import "./src/lib/locationTask";
import "expo-router/entry";
