import { Directory, File, Paths } from "expo-file-system";

// 주행 기록 하나. 폰 안의 문서 폴더에 trips/<id>.json 으로 저장한다.

export type TripPoint = {
  lat: number;
  lng: number;
  t: number; // 기록 시각 (epoch ms)
};

export type Trip = {
  id: string;
  courseId: string;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  points: TripPoint[];
};

function tripsDir(): Directory {
  return new Directory(Paths.document, "trips");
}

export async function saveTrip(trip: Trip): Promise<void> {
  const dir = tripsDir();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  const file = new File(dir, `${trip.id}.json`);
  file.write(JSON.stringify(trip));
}

// 없거나 읽기에 실패하면 undefined. 절대 던지지 않는다.
export async function loadTrip(id: string | undefined): Promise<Trip | undefined> {
  if (!id) return undefined;
  try {
    const file = new File(tripsDir(), `${id}.json`);
    if (!file.exists) return undefined;
    return JSON.parse(await file.text()) as Trip;
  } catch {
    return undefined;
  }
}
