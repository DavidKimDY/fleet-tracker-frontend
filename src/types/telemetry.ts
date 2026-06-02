export type GpsPoint = { lat: number; lng: number };

export type TimestampedGps = Record<string, { GPS: GpsPoint }>;

export type TimestampedSpeed = Record<string, { 속도: number }>;

export type RamEntry = {
  GPS?: GpsPoint;
  속도?: number | null;
  가속도?: number | null;
};

export type RamData = Record<string, Record<string, RamEntry>>;

export type TimeSeriesPoint = { time: number; value: number };
