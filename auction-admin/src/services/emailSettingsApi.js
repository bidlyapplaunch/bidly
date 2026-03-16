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
  },
  testTemplate: async (payload) => {
    const response = await api.post('/email-settings/test-template', payload);
    return response.data;
  },
  getCustomers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.search) query.set('search', params.search);
    const response = await api.get(`/email-settings/customers?${query.toString()}`);
    return response.data;
  }
};

