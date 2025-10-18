// Analytics utilities
// Using Plausible or Vercel Analytics

export const analytics = {
  track(eventName: string, properties?: Record<string, any>) {
    if (typeof window === 'undefined') return;
    
    // TODO: Integrate Plausible
    console.log('Analytics:', eventName, properties);
    
    // Example Plausible integration:
    // window.plausible?.(eventName, { props: properties });
  },

  pageView(url: string) {
    this.track('pageview', { url });
  },

  trackPigNamed(pigId: string) {
    this.track('pig_named', { pigId });
  },

  trackRitualCompleted(pigId: string, ritualType: string) {
    this.track('ritual_completed', { pigId, ritualType });
  },

  trackScan(pigId: string) {
    this.track('qr_scan', { pigId });
  }
};
