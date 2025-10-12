// File: mobile/src/hooks/useWebSocket.ts
// Purpose: React hook for WebSocket connection

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const SOCKET_URL = __DEV__
  ? 'http://localhost:4000'
  : 'https://portals-api.healthflow.ai';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  timestamp: string;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeSocket();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      disconnectSocket();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground, reconnect socket
      if (socketRef.current?.disconnected) {
        socketRef.current.connect();
      }
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background, disconnect socket to save battery
      socketRef.current?.disconnect();
    }

    appState.current = nextAppState;
  };

  const initializeSocket = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      
      if (!token) {
        console.log('No auth token, skipping socket connection');
        return;
      }

      const socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        console.log('WebSocket connected:', socket.id);
        setConnected(true);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error.message);
        setConnected(false);
      });

      // Listen for various events
      socket.on('notification', handleNotification);
      socket.on('recall:new', handleNewRecall);
      socket.on('recall:updated', handleRecallUpdate);
      socket.on('adverse-event:new', handleNewAdverseEvent);
      socket.on('medicine:updated', handleMedicineUpdate);

      socketRef.current = socket;
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleNotification = useCallback((data: Notification) => {
    console.log('Received notification:', data);
    setNotifications((prev) => [data, ...prev]);
  }, []);

  const handleNewRecall = useCallback((data: any) => {
    console.log('New recall:', data);
    handleNotification({
      id: data.id,
      type: 'recall',
      title: 'New Medicine Recall',
      message: `${data.medicine_name} has been recalled`,
      data,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const handleRecallUpdate = useCallback((data: any) => {
    console.log('Recall updated:', data);
    handleNotification({
      id: data.id,
      type: 'recall',
      title: 'Recall Updated',
      message: `Recall for ${data.medicine_name} has been updated`,
      data,
      timestamp: new Date().toISOString(),
    });
  }, []);

  const handleNewAdverseEvent = useCallback((data: any) => {
    console.log('New adverse event:', data);
  }, []);

  const handleMedicineUpdate = useCallback((data: any) => {
    console.log('Medicine updated:', data);
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const subscribe = useCallback((room: string) => {
    emit('subscribe', { room });
  }, [emit]);

  const unsubscribe = useCallback((room: string) => {
    emit('unsubscribe', { room });
  }, [emit]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    connected,
    notifications,
    emit,
    subscribe,
    unsubscribe,
    clearNotifications,
  };
}