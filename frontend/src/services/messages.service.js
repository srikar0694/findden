import api from './api';

export const messagesService = {
  getQuota: () => api.get('/messages/quota'),
  contacted: () => api.get('/messages/contacted'),
  send: (propertyId, body) => api.post(`/messages/property/${propertyId}`, { body }),
};
