import api from './api';

export const authService = {
  register: (data) => api.post('/auth/register', data),
  // data = { identifier, password }
  login: (data) => api.post('/auth/login', data),
  // data = { idToken, email, name, googleId, avatar, role }
  googleAuth: (data) => api.post('/auth/google', data),
  getMe: () => api.get('/auth/me'),
};
