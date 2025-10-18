// Route configuration
// Centralized route definitions

export const routes = {
  home: '/',
  pig: (pigId: string) => `/p/${pigId}`,
  about: '/about',
  api: {
    pig: (pigId: string) => `/api/pig/${pigId}`,
    pigName: (pigId: string) => `/api/pig/${pigId}/name`,
    pigRitual: (pigId: string) => `/api/pig/${pigId}/ritual`,
    pigHistory: (pigId: string) => `/api/pig/${pigId}/history`,
  }
};
