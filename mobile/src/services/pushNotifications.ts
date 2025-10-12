// File: mobile/src/services/pushNotifications.ts
// Purpose: Firebase Cloud Messaging setup

import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import apiClient from './api';

class PushNotificationService {
  private isInitialized = false;

  /**
   * Initialize push notifications
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Request permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('Push notification permission not granted');
        return;
      }

      // Get FCM token
      const token = await messaging().getToken();
      console.log('FCM Token:', token);

      // Save token locally
      await AsyncStorage.setItem('fcmToken', token);

      // Register token with backend
      await this.registerToken(token);

      // Setup notification handlers
      this.setupNotificationHandlers();

      // Create notification channels (Android)
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      this.isInitialized = true;
      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerToken(token: string) {
    try {
      await apiClient.registerPushToken(token, Platform.OS as 'ios' | 'android');
      console.log('Push token registered with backend');
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  /**
   * Setup notification event handlers
   */
  private setupNotificationHandlers() {
    // Foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Background/quit state messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // App opened from quit state by notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened by notification:', remoteMessage);
          this.handleNotificationPress(remoteMessage);
        }
      });

    // Notifee foreground events
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('Notifee notification pressed:', detail.notification);
        this.handleNotificationPress(detail.notification?.data);
      }
    });
  }

  /**
   * Create Android notification channels
   */
  private async createNotificationChannels() {
    await notifee.createChannel({
      id: 'default',
      name: 'Default',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    await notifee.createChannel({
      id: 'recalls',
      name: 'Medicine Recalls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    await notifee.createChannel({
      id: 'adverse-events',
      name: 'Adverse Events',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    await notifee.createChannel({
      id: 'general',
      name: 'General Notifications',
      importance: AndroidImportance.DEFAULT,
    });
  }

  /**
   * Display notification using Notifee
   */
  private async displayNotification(remoteMessage: any) {
    const { notification, data } = remoteMessage;

    if (!notification) return;

    const channelId = data?.type === 'recall' 
      ? 'recalls' 
      : data?.type === 'adverse-event'
      ? 'adverse-events'
      : 'general';

    await notifee.displayNotification({
      title: notification.title,
      body: notification.body,
      data,
      android: {
        channelId,
        smallIcon: 'ic_notification',
        color: '#1976d2',
        pressAction: {
          id: 'default',
        },
        largeIcon: notification.imageUrl,
      },
      ios: {
        sound: 'default',
        attachments: notification.imageUrl
          ? [{ url: notification.imageUrl }]
          : undefined,
      },
    });
  }

  /**
   * Handle notification press
   */
  private handleNotificationPress(data: any) {
    if (!data) return;

    // Navigate based on notification type
    const { type, id } = data;

    // You'll need to set up navigation service to handle this
    switch (type) {
      case 'recall':
        // Navigate to recall detail
        console.log('Navigate to recall:', id);
        break;
      case 'adverse-event':
        // Navigate to adverse event
        console.log('Navigate to adverse event:', id);
        break;
      case 'medicine':
        // Navigate to medicine detail
        console.log('Navigate to medicine:', id);
        break;
      default:
        console.log('Unknown notification type:', type);
    }
  }

  /**
   * Request notification permission (iOS)
   */
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  /**
   * Check if notifications are enabled
   */
  async checkPermission(): Promise<boolean> {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  /**
   * Get FCM token
   */
  async getToken(): Promise<string | null> {
    try {
      return await messaging().getToken();
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  /**
   * Delete FCM token
   */
  async deleteToken() {
    try {
      await messaging().deleteToken();
      await AsyncStorage.removeItem('fcmToken');
      console.log('FCM token deleted');
    } catch (error) {
      console.error('Failed to delete FCM token:', error);
    }
  }

  /**
   * Test notification (development only)
   */
  async sendTestNotification() {
    await notifee.displayNotification({
      title: 'Test Notification',
      body: 'This is a test notification',
      android: {
        channelId: 'default',
        smallIcon: 'ic_notification',
      },
    });
  }
}

export default new PushNotificationService();