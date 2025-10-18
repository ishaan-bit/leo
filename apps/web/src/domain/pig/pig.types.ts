export interface Pig {
  id: string;
  name?: string;
  scanCount: number;
  firstScanAt: string;
  lastScanAt: string;
  rituals: string[];
}

export interface PigNamePayload {
  name: string;
}

export interface RitualPayload {
  ritualType: string;
  completedAt: string;
}
