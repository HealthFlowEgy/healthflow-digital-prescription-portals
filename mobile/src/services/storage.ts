// File: mobile/src/services/offlineStorage.ts
// Purpose: Local data caching and offline support

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

interface CachedData {
  data: any;
  timestamp: number;
  expiresIn: number; // milliseconds
}

interface QueuedRequest {
  id: string;
  method: string;
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

class OfflineStorageService {
  private readonly CACHE_PREFIX = '@cache:';
  private readonly QUEUE_KEY = '@requestQueue';
  private readonly MAX_RETRY = 3;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize offline storage and sync
   */
  async initialize() {
    // Start listening for network changes
    NetInfo.addEventListener(state => {
      if (state.isConnected) {
        this.syncQueuedRequests();
      }
    });

    // Start periodic sync (every 5 minutes)
    this.syncInterval = setInterval(() => {
      this.syncQueuedRequests();
    }, 5 * 60 * 1000);

    console.log('Offline storage initialized');
  }

  /**
   * Cache data with expiration
   */
  async cacheData(key: string, data: any, expiresIn: number = 3600000) {
    try {
      const cachedData: CachedData = {
        data,
        timestamp: Date.now(),
        expiresIn,
      };

      await AsyncStorage.setItem(
        `${this.CACHE_PREFIX}${key}`,
        JSON.stringify(cachedData)
      );

      console.log(`Cached data: ${key}`);
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  /**
   * Get cached data if not expired
   */
  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${this.CACHE_PREFIX}${key}`);
      
      if (!cached) {
        return null;
      }

      const cachedData: CachedData = JSON.parse(cached);
      const now = Date.now();

      // Check if expired
      if (now - cachedData.timestamp > cachedData.expiresIn) {
        await this.clearCache(key);
        return null;
      }

      return cachedData.data as T;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  /**
   * Clear specific cache
   */
  async clearCache(key: string) {
    try {
      await AsyncStorage.removeItem(`${this.CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log('All cache cleared');
    } catch (error) {
      console.error('Failed to clear all cache:', error);
    }
  }

  /**
   * Queue request for later when offline
   */
  async queueRequest(method: string, endpoint: string, data: any) {
    try {
      const request: QueuedRequest = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method,
        endpoint,
        data,
        timestamp: Date.now(),
        retryCount: 0,
      };

      const queue = await this.getRequestQueue();
      queue.push(request);
      
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      
      console.log(`Queued request: ${method} ${endpoint}`);
      return request.id;
    } catch (error) {
      console.error('Failed to queue request:', error);
      throw error;
    }
  }

  /**
   * Get request queue
   */
  private async getRequestQueue(): Promise<QueuedRequest[]> {
    try {
      const queue = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Failed to get request queue:', error);
      return [];
    }
  }

  /**
   * Sync queued requests when online
   */
  async syncQueuedRequests() {
    const netInfo = await NetInfo.fetch();
    
    if (!netInfo.isConnected) {
      console.log('Device offline, skipping sync');
      return;
    }

    try {
      const queue = await this.getRequestQueue();
      
      if (queue.length === 0) {
        return;
      }

      console.log(`Syncing ${queue.length} queued requests`);

      const remaining: QueuedRequest[] = [];

      for (const request of queue) {
        try {
          // Attempt to send request
          await this.sendQueuedRequest(request);
          console.log(`Synced request: ${request.id}`);
        } catch (error) {
          console.error(`Failed to sync request ${request.id}:`, error);
          
          // Retry if under max retry count
          if (request.retryCount < this.MAX_RETRY) {
            request.retryCount++;
            remaining.push(request);
          } else {
            console.log(`Dropping request ${request.id} after ${this.MAX_RETRY} retries`);
          }
        }
      }

      // Update queue with remaining requests
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remaining));
      
      if (remaining.length === 0) {
        console.log('All queued requests synced');
      } else {
        console.log(`${remaining.length} requests still in queue`);
      }
    } catch (error) {
      console.error('Failed to sync queued requests:', error);
    }
  }

  /**
   * Send a queued request
   */
  private async sendQueuedRequest(request: QueuedRequest) {
    const apiClient = require('./api').default;
    const axios = apiClient.getClient();

    const config: any = {
      method: request.method,
      url: request.endpoint,
    };

    if (request.method !== 'GET' && request.data) {
      config.data = request.data;
    }

    await axios(config);
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    const queue = await this.getRequestQueue();
    return {
      count: queue.length,
      oldestRequest: queue.length > 0 ? new Date(queue[0].timestamp) : null,
    };
  }

  /**
   * Cache medicines for offline access
   */
  async cacheMedicines(medicines: any[]) {
    await this.cacheData('medicines:all', medicines, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Get cached medicines
   */
  async getCachedMedicines(): Promise<any[]> {
    return (await this.getCachedData<any[]>('medicines:all')) || [];
  }

  /**
   * Cache medicine detail
   */
  async cacheMedicineDetail(id: string, medicine: any) {
    await this.cacheData(`medicine:${id}`, medicine, 12 * 60 * 60 * 1000); // 12 hours
  }

  /**
   * Get cached medicine detail
   */
  async getCachedMedicineDetail(id: string) {
    return await this.getCachedData(`medicine:${id}`);
  }

  /**
   * Cache recalls
   */
  async cacheRecalls(recalls: any[]) {
    await this.cacheData('recalls:all', recalls, 1 * 60 * 60 * 1000); // 1 hour
  }

  /**
   * Get cached recalls
   */
  async getCachedRecalls(): Promise<any[]> {
    return (await this.getCachedData<any[]>('recalls:all')) || [];
  }

  /**
   * Save draft adverse event
   */
  async saveDraftAdverseEvent(draft: any) {
    await AsyncStorage.setItem('@draft:adverse-event', JSON.stringify(draft));
  }

  /**
   * Get draft adverse event
   */
  async getDraftAdverseEvent() {
    const draft = await AsyncStorage.getItem('@draft:adverse-event');
    return draft ? JSON.parse(draft) : null;
  }

  /**
   * Clear draft adverse event
   */
  async clearDraftAdverseEvent() {
    await AsyncStorage.removeItem('@draft:adverse-event');
  }

  /**
   * Get storage info
   */
  async getStorageInfo() {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
    
    return {
      totalKeys: keys.length,
      cacheKeys: cacheKeys.length,
      queueSize: (await this.getRequestQueue()).length,
    };
  }

  /**
   * Cleanup on app close
   */
  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export default new OfflineStorageService();