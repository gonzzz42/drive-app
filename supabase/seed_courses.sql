-- data/courses.json 의 코스를 Supabase courses 테이블에 넣는다 (SQL Editor에 붙여넣기)
-- 좌표가 없는 코스는 제외: paju-77-pyeonghwa-goyang
-- 다시 실행해도 안전하다 (이미 있으면 건너뜀)

insert into public.courses
  (id, name, region, tags, distance_km, start_name, end_name, start_lat, start_lng, end_lat, end_lng, best_time, avoid_time, polyline, is_official)
values
  ('olympic-magok-gayang-night', '마곡 → 가양 빛의 관문', '서울서부', ARRAY['밤','조명','도시고속']::text[], 12.4, '마곡대교', '가양대교', 37.569, 126.828, 37.561, 126.86, '평일 21시 이후', '주말 낮, 퇴근 정체', '[{"lat":37.569,"lng":126.828},{"lat":37.565,"lng":126.845},{"lat":37.561,"lng":126.86}]'::jsonb, false),
  ('jayu-ro-haengju-imjingak', '자유로 행주 → 임진각', '경기서북', ARRAY['강변','밤','파주']::text[], 46, '행주대교 북단', '임진각', 37.599, 126.81, 37.889, 126.74, '평일 밤, 노을', '주말 오후', '[{"lat":37.599,"lng":126.81},{"lat":37.75,"lng":126.78},{"lat":37.889,"lng":126.74}]'::jsonb, false)
on conflict (id) do nothing;
