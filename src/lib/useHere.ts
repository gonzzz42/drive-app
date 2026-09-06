import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./courses";

// 내 위치 한 점. 상태를 구분해서 돌려준다.
//   loading     확인 중
//   denied      위치 권한 없음 (권한은 처음 한 번만 묻는다)
//   unavailable 위치 서비스 꺼짐 또는 위치를 못 잡음
//   ready       here 에 좌표가 있다
// 권한이 없을 때 기본 좌표를 '내 위치'처럼 돌려주지 않는다.

export type HereStatus = "loading" | "denied" | "unavailable" | "ready";

export type HereState = { status: HereStatus; here?: LatLng };

export function useHere(): HereState & { refresh: () => void } {
  const [state, setState] = useState<HereState>({ status: "loading" });
  const asked = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      // 권한은 처음 한 번만 묻는다. 그 뒤로는 현재 상태만 읽는다.
      const perm = asked.current
        ? await Location.getForegroundPermissionsAsync()
        : await Location.requestForegroundPermissionsAsync();
      asked.current = true;
      if (perm.status !== "granted") {
        if (alive.current) setState({ status: "denied" });
        return;
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        if (alive.current) setState({ status: "unavailable" });
        return;
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
      const pos =
        last ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (alive.current) {
        setState({ status: "ready", here: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
      }
    } catch {
      if (alive.current) setState({ status: "unavailable" });
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // 탭이 보일 때마다 다시 읽는다 (설정에서 권한을 바꾸고 돌아온 경우 포함)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { ...state, refresh: load };
}
