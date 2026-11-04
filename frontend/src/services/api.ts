import axios from 'axios';

// Defaults to '/api' so Vite proxy in vite.config.ts forwards to http://localhost:5001/api without CORS
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface HealthResponse {
  status: 'UP' | 'DEGRADED';
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  database: {
    connected: boolean;
    message: string;
  };
  timestamp: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  // Accept both 200 (UP) and 503 (DEGRADED) so offline DB state is properly reported to the UI
  const response = await apiClient.get<HealthResponse>('/health', {
    validateStatus: (status) => status === 200 || status === 503,
  });
  return response.data;
}
