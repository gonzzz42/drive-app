// app.json 위에 구글 지도 키만 얹는다.
// 키는 코드에 넣지 않고 환경변수 GOOGLE_MAPS_ANDROID_KEY 로 받는다.
//   - 내 컴퓨터: .env 파일에 한 줄 (git에 올라가지 않음)
//   - EAS 클라우드 빌드: `eas env:create` 로 등록 (아래 안내 참고)
// 키가 없으면 그냥 app.json 그대로 쓴다. (Expo Go에서는 어차피 이 키를 읽지 않는다)
module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (!apiKey) return config;
  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...(config.android?.config ?? {}),
        googleMaps: { apiKey },
      },
    },
  };
};
