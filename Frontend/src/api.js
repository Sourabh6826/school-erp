import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/api\/?$/, '').replace(/\/+$/, '') + '/api/',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Keep for potential cross-origin needs, but token is primary now
});

// Add a request interceptor to add the token to the header
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Token ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
