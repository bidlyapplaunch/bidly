import api from './api';

export const emailSettingsAPI = {
  getSettings: async () => {
    const response = await api.get('/email-settings');
    return response.data;
  },
  saveSettings: async (payload) => {
    const response = await api.post('/email-settings', payload);
    return response.data;
  },
  testSmtp: async (payload) => {
    const response = await api.post('/email-settings/test-smtp', payload);
    return response.data;
  }
};

