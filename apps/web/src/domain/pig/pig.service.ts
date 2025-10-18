import { Pig, PigNamePayload, RitualPayload } from './pig.types';
import { httpClient } from '@/lib/http';

export const pigService = {
  async getPig(pigId: string): Promise<Pig> {
    return httpClient.get<Pig>(`/api/pig/${pigId}`);
  },

  async updatePigName(pigId: string, payload: PigNamePayload): Promise<Pig> {
    return httpClient.post<Pig>(`/api/pig/${pigId}/name`, payload);
  },

  async logRitual(pigId: string, payload: RitualPayload): Promise<void> {
    return httpClient.post<void>(`/api/pig/${pigId}/ritual`, payload);
  },

  async getPigHistory(pigId: string): Promise<any> {
    return httpClient.get<any>(`/api/pig/${pigId}/history`);
  }
};
