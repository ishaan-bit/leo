/**
 * Stage 1 → Primary Zoom Orchestration
 * 
 * Manages the timeline between enrichment completion and zoom trigger.
 * Ensures zoom only fires when BOTH conditions are met:
 * 1. Pulsating skyline animation complete
 * 2. Backend wheel.primary value present in Upstash
 */

export type WillcoxPrimary = 'joyful' | 'sad' | 'mad' | 'scared' | 'powerful' | 'peaceful';

export interface TowerMapping {
  name: string;
  color: string;
  id: WillcoxPrimary;
}

export interface StageState {
  primary: WillcoxPrimary | null;
  towerName: string | null;
  pulsingComplete: boolean;
  primaryReady: boolean;
  hasZoomTriggered: boolean;
  timestamp: string | null;
}

// Tower mapping: Willcox primary → City tower
// MAPPING: joyful→Vera, powerful→Ashmere, peaceful→Haven, sad→Vanta, scared→Vire, mad→Sable
const TOWER_MAP: Record<WillcoxPrimary, TowerMapping> = {
  joyful: { id: 'joyful', name: 'Vera', color: '#FFD700' },
  powerful: { id: 'powerful', name: 'Ashmere', color: '#FF6B35' },
  peaceful: { id: 'peaceful', name: 'Haven', color: '#6A9FB5' },
  sad: { id: 'sad', name: 'Vanta', color: '#7D8597' },
  scared: { id: 'scared', name: 'Vire', color: '#5A189A' },
  mad: { id: 'mad', name: 'Sable', color: '#C1121F' },
};

export class StageOrchestrator {
  private state: StageState = {
    primary: null,
    towerName: null,
    pulsingComplete: false,
    primaryReady: false,
    hasZoomTriggered: false,
    timestamp: null,
  };

  private listeners: Set<(state: StageState) => void> = new Set();
  private zoomCallbacks: Set<(primary: WillcoxPrimary, tower: TowerMapping) => void> = new Set();

  constructor(private rid: string) {}

  /**
   * 1. Listen - Backend signals primary is ready
   */
  setPrimary(primary: string | null): void {
    if (!primary) return;

    const normalized = primary.toLowerCase() as WillcoxPrimary;
    
    if (!TOWER_MAP[normalized]) {
      console.warn(`[Orchestrator] Invalid primary: ${primary}`);
      return;
    }

    const tower = TOWER_MAP[normalized];

    this.state.primary = normalized;
    this.state.towerName = tower.name;
    this.state.primaryReady = true;
    this.state.timestamp = new Date().toISOString();

    console.log(`[Orchestrator] 🎯 Primary ready: ${normalized} → ${tower.name}`);

    this.notifyListeners();
    this.checkGateCondition();
  }

  /**
   * 3. Timeline synchronization - Skyline pulsing complete
   */
  markPulsingComplete(): void {
    this.state.pulsingComplete = true;

    console.log(`[Orchestrator] ✅ Pulsing timeline complete`);

    this.notifyListeners();
    this.checkGateCondition();
  }

  /**
   * 4. Gate condition - Both conditions met, trigger zoom
   */
  private checkGateCondition(): void {
    const { pulsingComplete, primaryReady, hasZoomTriggered, primary } = this.state;

    if (hasZoomTriggered) {
      console.log(`[Orchestrator] ⏭️  Zoom already triggered, ignoring gate check`);
      return;
    }

    if (!pulsingComplete) {
      console.log(`[Orchestrator] ⏳ Waiting for pulsing to complete...`);
      return;
    }

    if (!primaryReady || !primary) {
      console.log(`[Orchestrator] ⏳ Waiting for primary from backend...`);
      return;
    }

    // Both conditions met - trigger zoom!
    this.triggerZoom();
  }

  /**
   * 5. Trigger - Execute zoom sequence
   */
  private triggerZoom(): void {
    const { primary, towerName } = this.state;

    if (!primary || !towerName) {
      console.error(`[Orchestrator] Cannot trigger zoom: missing primary or tower`);
      return;
    }

    this.state.hasZoomTriggered = true;

    const tower = TOWER_MAP[primary];

    // 6. Telemetry
    const telemetry = {
      event: 'zoom_started',
      rid: this.rid,
      primary,
      tower: towerName,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Orchestrator] 🚀 ZOOM TRIGGERED:`, telemetry);

    // Emit to window for analytics
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('stage1_zoom_started', { detail: telemetry })
      );
    }

    // Notify all zoom callbacks
    this.zoomCallbacks.forEach((callback) => callback(primary, tower));

    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: StageState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to zoom trigger
   */
  onZoom(callback: (primary: WillcoxPrimary, tower: TowerMapping) => void): () => void {
    this.zoomCallbacks.add(callback);
    return () => this.zoomCallbacks.delete(callback);
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<StageState> {
    return { ...this.state };
  }

  /**
   * Reset orchestrator (for testing or replay)
   */
  reset(): void {
    this.state = {
      primary: null,
      towerName: null,
      pulsingComplete: false,
      primaryReady: false,
      hasZoomTriggered: false,
      timestamp: null,
    };

    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }

  /**
   * Helper: Map primary to tower
   */
  static getTower(primary: WillcoxPrimary): TowerMapping {
    return TOWER_MAP[primary];
  }

  /**
   * Helper: Validate primary
   */
  static isValidPrimary(value: string): value is WillcoxPrimary {
    const normalized = value.toLowerCase();
    return normalized in TOWER_MAP;
  }
}
