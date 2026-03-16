import api from './api';

export const blastEmailAPI = {
  list: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    const response = await api.get(`/email-settings/blasts?${query.toString()}`);
    return response.data;
  },

  get: async (id) => {
    const response = await api.get(`/email-settings/blasts/${id}`);
    return response.data;
  },

  getProgress: async (id) => {
    const response = await api.get(`/email-settings/blasts/${id}/progress`);
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post('/email-settings/blasts', payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/email-settings/blasts/${id}`, payload);
    return response.data;
  },

  send: async (id) => {
    const response = await api.post(`/email-settings/blasts/${id}/send`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/email-settings/blasts/${id}`);
    return response.data;
  }
};
