import type { LocationObject } from "expo-location";
import { handleLocations, LOCATION_TASK, locationsToPoints, noteCollectorError } from "./recording";
import { TaskManager } from "./taskManager";

// 백그라운드 위치 작업 정의. 화면 effect 가 아니라 모듈 최상위에서 한 번 정의한다.
// 앱 시작점(index.ts)이 이 모듈을 불러오므로, 화면이 없는 실행(Android 헤드리스)에서도 정의돼 있다.
// 세션이 없거나 종료 처리 중이면 엔진이 좌표를 버린다. 여기서 서버로 보내지 않는다.
// 네이티브 모듈이 없는 빌드(옛 APK, Expo Go)에서는 정의를 건너뛴다. 그때는 포그라운드 기록만 된다.

type LocationTaskData = { locations?: LocationObject[] };

if (TaskManager) {
  TaskManager.defineTask<LocationTaskData>(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      noteCollectorError(error.message || "위치를 받지 못했습니다.");
      return;
    }
    const locations = data?.locations;
    if (locations && locations.length > 0) {
      handleLocations(locationsToPoints(locations));
    }
  });
}
