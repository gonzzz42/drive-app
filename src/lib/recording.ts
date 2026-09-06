import { Directory, File, Paths } from "expo-file-system";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  CollectorError,
  LOCATION_TASK,
  RecordingEngine,
  type Collector,
  type FinishResult,
  type RecordingSnapshot,
  type ResumeResult,
  type SessionStorage,
  type StartResult,
} from "./recordingCore";
import { backgroundTaskAvailable } from "./taskManager";
import type { TripPoint } from "./tripModel";
import { saveTrip } from "./trips";

// 폰에서 도는 기록 세션. 규칙은 recordingCore.ts 의 엔진에 있고, 여기서는
//   - 저장소: 문서 폴더 recording/session.json + recording/points.jsonl
//   - 수집기: 백그라운드 위치 작업(expo-task-manager) → 안 되면 포그라운드 watcher
// 를 끼운다. 화면은 이 모듈의 함수와 useRecording() 만 쓴다.
//
// 좌표를 받는 길은 둘이지만(백그라운드 작업 locationTask.ts / 포그라운드 watcher) 동시에 켜지 않는다.
// 둘 다 handleLocations() 로 들어와 엔진 하나가 파일에 덧붙인다.

export { LOCATION_TASK } from "./recordingCore";
export type { RecordingSession, RecordingSnapshot } from "./recordingCore";

const POINT_INTERVAL_MS = 3000;

// ---- 저장소 ----

const dir = new Directory(Paths.document, "recording");
const sessionFile = new File(dir, "session.json");
const pointsFile = new File(dir, "points.jsonl");

function ensureDir(): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

const fileStorage: SessionStorage = {
  readSession: () => (sessionFile.exists ? sessionFile.textSync() : null),
  writeSession: (text) => {
    ensureDir();
    sessionFile.write(text);
  },
  clearSession: () => {
    if (sessionFile.exists) sessionFile.delete();
  },
  readPoints: () => (pointsFile.exists ? pointsFile.textSync() : ""),
  appendPoints: (text) => {
    ensureDir();
    if (pointsFile.exists) pointsFile.write(text, { append: true });
    else pointsFile.write(text);
  },
  clearPoints: () => {
    if (pointsFile.exists) pointsFile.delete();
  },
};

// ---- 수집기 ----

export function locationsToPoints(locations: Location.LocationObject[]): TripPoint[] {
  return locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    t: l.timestamp, // GPS 측정 시각. 배달된 시각(Date.now)이 아니다
  }));
}

let foregroundSub: Location.LocationSubscription | undefined;

async function hasBackgroundTask(): Promise<boolean> {
  if (!backgroundTaskAvailable) return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

// 위치 서비스 → 포그라운드 권한 순서로 확인한다. 안 되면 이유를 담아 던진다.
async function checkPermissions(): Promise<void> {
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new CollectorError("services", "위치 서비스가 꺼져 있습니다. 설정에서 위치를 켜 주세요.");
  }
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    throw new CollectorError(
      "permission",
      "위치 권한이 없어 기록할 수 없습니다. 설정에서 위치 권한을 허용해 주세요.",
    );
  }
}

// 백그라운드 위치 작업. 화면을 끄거나 다른 앱(내비)으로 가도 좌표가 온다.
// Android 는 알림이 있는 foreground service, iOS 는 백그라운드 위치 표시(파란 표시)로 돈다.
// 켜지지 않으면 false (네이티브 모듈이 없는 옛 빌드·Expo Go, 설정 누락 등).
async function startBackground(): Promise<boolean> {
  if (!backgroundTaskAvailable) return false;
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: POINT_INTERVAL_MS,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.LocationActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "드라이브 기록 중",
        notificationBody: "경로를 기록하고 있습니다. 종료하려면 앱을 여세요.",
        notificationColor: "#2766C7",
        killServiceOnDestroy: false,
      },
    });
    return await hasBackgroundTask();
  } catch {
    return false;
  }
}

// 포그라운드 watcher. 앱이 열려 있을 때만 좌표가 온다.
async function startForeground(onLocations: (points: TripPoint[]) => void): Promise<void> {
  foregroundSub?.remove();
  foregroundSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: POINT_INTERVAL_MS, distanceInterval: 0 },
    (loc) => onLocations(locationsToPoints([loc])),
    (reason) => engine.noteError(reason || "위치를 받지 못했습니다."),
  );
}

const expoCollector: Collector = {
  async start(onLocations) {
    await checkPermissions();
    // 하나만 켠다. 백그라운드 작업이 켜졌으면 포그라운드 watcher 는 쓰지 않는다 (좌표 중복 방지).
    if (await startBackground()) {
      foregroundSub?.remove();
      foregroundSub = undefined;
      return "background";
    }
    try {
      await startForeground(onLocations);
    } catch {
      throw new CollectorError("collector", "위치 수집을 시작하지 못했습니다.");
    }
    return "foreground";
  },
  async stop() {
    foregroundSub?.remove();
    foregroundSub = undefined;
    if (await hasBackgroundTask()) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
    // 실제로 멈췄는지 확인. 아직 돌고 있으면 종료를 완료로 치지 않는다.
    if (await hasBackgroundTask()) throw new Error("백그라운드 위치 작업이 멈추지 않았습니다.");
  },
  async isRunning(kind) {
    if (kind === "background") return hasBackgroundTask();
    if (kind === "foreground") return foregroundSub != null;
    return false;
  },
};

// ---- 엔진 (앱 전체에 하나) ----

const engine = new RecordingEngine({
  storage: fileStorage,
  collector: expoCollector,
  saveTrip,
});

// 백그라운드 작업(locationTask.ts)과 포그라운드 watcher 가 좌표를 넘기는 곳
export function handleLocations(points: TripPoint[]): number {
  return engine.handleLocations(points);
}

export function noteCollectorError(message: string): void {
  engine.noteError(message);
}

// 앱 시작 시 한 번. 저장된 세션이 있으면 수집기가 아직 도는지 확인만 한다. 새 기록을 시작하지 않는다.
export async function initRecording(): Promise<void> {
  await engine.refreshCollector();
}

export function startRecording(courseId: string | null): Promise<StartResult> {
  return engine.start(courseId);
}

export function finishRecording(): Promise<FinishResult> {
  return engine.finish();
}

export function resumeRecording(): Promise<ResumeResult> {
  return engine.resume();
}

export function getRecordingSnapshot(): RecordingSnapshot {
  return engine.getSnapshot();
}

// 화면으로 돌아왔을 때: 파일의 좌표와 수집기 상태를 다시 읽는다
export async function refreshRecording(): Promise<void> {
  engine.reloadPoints();
  await engine.refreshCollector();
}

export function useRecording(): RecordingSnapshot {
  const [snap, setSnap] = useState(() => engine.getSnapshot());
  useEffect(() => {
    setSnap(engine.getSnapshot());
    return engine.subscribe(() => setSnap(engine.getSnapshot()));
  }, []);
  return snap;
}
