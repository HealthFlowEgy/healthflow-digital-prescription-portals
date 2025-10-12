// File: mobile/src/services/api.ts
// Purpose: API client with token management and offline support

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

const API_BASE_URL = __DEV__ 
  ? Platform.OS === 'ios' 
    ? 'http://localhost:4000/api/v2' 
    : 'http://10.0.2.2:4000/api/v2'
  : 'https://portals-api.healthflow.ai/api/v2';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Platform': Platform.OS,
        'X-Client-Version': '1.0.0',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Check network connectivity
        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) {
          throw new Error('No internet connection');
        }

        // Add auth token
        const token = await AsyncStorage.getItem('authToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Handle 401 errors (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                }
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = await AsyncStorage.getItem('refreshToken');
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            });

            const { token } = response.data.data;
            await AsyncStorage.setItem('authToken', token);

            this.refreshSubscribers.forEach((callback) => callback(token));
            this.refreshSubscribers = [];

            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }

            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout user
            await this.logout();
            throw refreshError;
          } finally {
            this.isRefreshing = false;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { token, refreshToken, user } = response.data.data;

    await AsyncStorage.multiSet([
      ['authToken', token],
      ['refreshToken', refreshToken],
      ['user', JSON.stringify(user)],
    ]);

    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user']);
    }
  }

  async register(data: any) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  // Medicine methods
  async searchMedicines(query: string, filters?: any) {
    const response = await this.client.get('/medicines/search', {
      params: { q: query, ...filters },
    });
    return response.data.data;
  }

  async getMedicine(id: string) {
    const response = await this.client.get(`/medicines/${id}`);
    return response.data.data;
  }

  // Recall methods
  async getRecalls(params?: any) {
    const response = await this.client.get('/recalls', { params });
    return response.data.data;
  }

  async getRecallById(id: string) {
    const response = await this.client.get(`/recalls/${id}`);
    return response.data.data;
  }

  // Adverse event methods
  async submitAdverseEvent(data: any) {
    const response = await this.client.post('/adverse-events', data);
    return response.data.data;
  }

  async getMyAdverseEvents() {
    const response = await this.client.get('/adverse-events/my');
    return response.data.data;
  }

  // Notification methods
  async getNotifications() {
    const response = await this.client.get('/notifications');
    return response.data.data;
  }

  async markNotificationRead(id: string) {
    const response = await this.client.patch(`/notifications/${id}/read`);
    return response.data;
  }

  async registerPushToken(token: string, platform: 'ios' | 'android') {
    const response = await this.client.post('/notifications/register-device', {
      token,
      platform,
      deviceId: await this.getDeviceId(),
    });
    return response.data;
  }

  // User methods
  async getProfile() {
    const response = await this.client.get('/users/profile');
    return response.data.data;
  }

  async updateProfile(data: any) {
    const response = await this.client.patch('/users/profile', data);
    return response.data.data;
  }

  // Analytics methods
  async getDashboardStats() {
    const response = await this.client.get('/analytics/mobile-dashboard');
    return response.data.data;
  }

  // Utility methods
  private async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(7);
      await AsyncStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  // Get axios instance for custom requests
  getClient(): AxiosInstance {
    return this.client;
  }
}

export default new ApiClient();