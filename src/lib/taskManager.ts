// expo-task-manager 를 안전하게 불러온다.
// 이 패키지는 불러오는 순간 네이티브 모듈 'ExpoTaskManager' 를 찾고, 없으면 던진다.
// 옛 개발 빌드(APK)나 Expo Go 처럼 네이티브 모듈이 없는 빌드에서는 앱이 시작부터 죽지 않도록
// undefined 로 두고, 기록은 포그라운드(앱을 열어둔 동안)로만 돈다.

type TaskManagerModule = typeof import("expo-task-manager");

let loaded: TaskManagerModule | undefined;
try {
  loaded = require("expo-task-manager") as TaskManagerModule;
} catch {
  loaded = undefined;
}

export const TaskManager: TaskManagerModule | undefined = loaded;

// 이 빌드에서 백그라운드 위치 작업을 쓸 수 있는지 (네이티브 모듈이 들어 있는지)
export const backgroundTaskAvailable = loaded != null;
