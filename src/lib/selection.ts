import { useEffect, useState } from "react";
import { courses, type Course } from "./courses";

// 드라이브 탭에서 쓸 "선택한 코스". 코스 상세의 [이 코스 선택]이 넣고, 드라이브 탭이 읽는다.
// 선택만으로는 기록이 시작되지 않는다. 앱을 껐다 켜면 비워진다 (기록 세션은 courseId 를 따로 갖는다).

let selectedId: string | null = null;
const listeners = new Set<() => void>();

export function selectCourse(id: string | null): void {
  selectedId = id;
  for (const l of listeners) l();
}

// 공개(is_official) 코스만 선택할 수 있다. 없으면 undefined.
export function getSelectedCourse(): Course | undefined {
  if (!selectedId) return undefined;
  return courses.find((c) => c.id === selectedId);
}

export function useSelectedCourse(): Course | undefined {
  const [course, setCourse] = useState(getSelectedCourse);
  useEffect(() => {
    const l = () => setCourse(getSelectedCourse());
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return course;
}
