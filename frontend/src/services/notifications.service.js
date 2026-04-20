import api from './api';

export const notificationsService = {
  /** Notify the owner that the buyer wants a callback. */
  requestCallback: (propertyId) =>
    api.post(`/notifications/request-callback/${propertyId}`),

  /** Send a free-form message to the owner. */
  sendMessage: (propertyId, message) =>
    api.post(`/notifications/send-message/${propertyId}`, { message }),

  /** Owner-side: list notifications received about my listings. */
  inbox: () => api.get('/notifications/inbox'),
};
