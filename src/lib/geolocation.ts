import type { GpsPoint } from '../types/telemetry';

export type GeoPosition = GpsPoint & { time: number };

export type GeoErrorCode =
  | 'permission_denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10_000,
};

export function getCurrentGeoPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'unsupported' as GeoErrorCode });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          time: position.timestamp / 1000,
        });
      },
      (error) => {
        const code: GeoErrorCode =
          error.code === error.PERMISSION_DENIED
            ? 'permission_denied'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unavailable';
        reject({ code, message: error.message });
      },
      GEO_OPTIONS
    );
  });
}

export function geoErrorMessage(code: GeoErrorCode): string {
  switch (code) {
    case 'permission_denied':
      return '위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용한 뒤 다시 시도하세요.';
    case 'timeout':
      return '위치를 가져오는 데 시간이 초과되었습니다. 다음 주기에 재시도합니다.';
    case 'unavailable':
      return '위치 정보를 사용할 수 없습니다.';
    default:
      return '이 브라우저는 Geolocation API를 지원하지 않습니다.';
  }
}
