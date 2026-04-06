import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('viberyan_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('viberyan_token');
      localStorage.removeItem('viberyan_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  register: (data: { username: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  searchUsers: (query: string) =>
    api.get(`/auth/users/search?q=${encodeURIComponent(query)}`),
};

// Rooms
export const roomApi = {
  getMyRooms: () => api.get('/rooms'),
  createRoom: (data: { name: string; description?: string; isPrivate?: boolean }) =>
    api.post('/rooms', data),
  joinRoom: (roomId: string) => api.post(`/rooms/${roomId}/join`),
  leaveRoom: (roomId: string) => api.post(`/rooms/${roomId}/leave`),
  getMessages: (roomId: string, cursor?: string) =>
    api.get(`/rooms/${roomId}/messages${cursor ? `?cursor=${cursor}` : ''}`),
  inviteUser: (roomId: string, username: string) =>
    api.post(`/rooms/${roomId}/invite`, { username }),
  getPendingInvites: () => api.get('/rooms/invites/pending'),
  declineInvite: (inviteId: string) => api.delete(`/rooms/invites/${inviteId}`),
  browsePublic: () => api.get('/rooms/browse/public'),
};

// Upload
export const uploadApi = {
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
