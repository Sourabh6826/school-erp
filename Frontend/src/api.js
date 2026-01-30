import axios from 'axios';

const api = axios.create({
    baseURL: (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/api\/?$/, '').replace(/\/+$/, '') + '/api/',
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Enable sending cookies for session authentication
});

export default api;
