import type { GpsPoint } from '../types/telemetry';

export type GeoPosition = GpsPoint & { time: number };

export type GeoErrorCode =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unsupported';

export function getCurrentGeoPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'unsupported' as const });
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
        const codeMap: Record<number, GeoErrorCode> = {
          [GeolocationPositionError.PERMISSION_DENIED]: 'permission_denied',
          [GeolocationPositionError.POSITION_UNAVAILABLE]: 'position_unavailable',
          [GeolocationPositionError.TIMEOUT]: 'timeout',
        };
        reject({ code: codeMap[error.code] ?? 'position_unavailable' });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  });
}

export function geoErrorMessage(code: GeoErrorCode): string {
  switch (code) {
    case 'permission_denied':
      return '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.';
    case 'position_unavailable':
      return '위치를 가져올 수 없습니다.';
    case 'timeout':
      return '위치 요청 시간이 초과되었습니다.';
    case 'unsupported':
      return '이 브라우저는 Geolocation API를 지원하지 않습니다.';
    default:
      return '위치 오류가 발생했습니다.';
  }
}
