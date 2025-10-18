// Local storage utilities with type safety

export const storage = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  remove(key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  clear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  }
};

// Pig-specific storage helpers
export const pigStorage = {
  getPigData(pigId: string) {
    return storage.get<{
      pigId: string;
      name?: string;
      lastVisit: string;
      scanCount: number;
    }>(`pig_${pigId}`);
  },

  setPigData(pigId: string, data: any) {
    storage.set(`pig_${pigId}`, {
      ...data,
      lastVisit: new Date().toISOString(),
    });
  }
};
