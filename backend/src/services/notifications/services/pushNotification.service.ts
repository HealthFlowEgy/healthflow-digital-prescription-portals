// File: backend/services/notifications/pushNotification.service.ts
// Purpose: Send push notifications via FCM and APNs

import admin from 'firebase-admin';
import { db } from '../../shared/database/connection';
import { logger } from '../../shared/utils/logger';
import { getWebSocketService } from '../websocket/websocket.service';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

interface PushNotificationData {
  userId?: string;
  tenantId?: string;
  title: string;
  body: string;
  type: 'recall' | 'adverse-event' | 'medicine' | 'general';
  data?: any;
  imageUrl?: string;
}

interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  userId: string;
}

export class PushNotificationService {
  /**
   * Send push notification to specific user
   */
  static async sendToUser(userId: string, notification: PushNotificationData) {
    try {
      // Get user's device tokens
      const devices = await db('portal.device_tokens')
        .where({ user_id: userId, is_active: true });

      if (devices.length === 0) {
        logger.info(`No devices found for user ${userId}`);
        return;
      }

      const tokens = devices.map(d => d.token);

      // Send via FCM
      await this.sendMulticast(tokens, notification);

      // Also send via WebSocket if user is online
      const wsService = getWebSocketService();
      wsService.sendToUser(userId, 'notification', {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: notification.data,
      });

      logger.info(`Sent push notification to user ${userId} on ${tokens.length} devices`);
    } catch (error) {
      logger.error(`Failed to send push notification to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Send push notification to all users in tenant
   */
  static async sendToTenant(tenantId: string, notification: PushNotificationData) {
    try {
      // Get all users in tenant
      const users = await db('portal.user_tenants')
        .select('user_id')
        .where({ tenant_id: tenantId, status: 'active' });

      const userIds = users.map(u => u.user_id);

      // Get all device tokens for these users
      const devices = await db('portal.device_tokens')
        .whereIn('user_id', userIds)
        .where({ is_active: true });

      if (devices.length === 0) {
        logger.info(`No devices found for tenant ${tenantId}`);
        return;
      }

      const tokens = devices.map(d => d.token);

      // Send via FCM in batches (FCM limit: 500 per request)
      const batchSize = 500;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        await this.sendMulticast(batch, notification);
      }

      // Also send via WebSocket
      const wsService = getWebSocketService();
      wsService.sendToTenant(tenantId, 'notification', {
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: notification.data,
      });

      logger.info(`Sent push notification to tenant ${tenantId} (${tokens.length} devices)`);
    } catch (error) {
      logger.error(`Failed to send push notification to tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Send multicast message via FCM
   */
  private static async sendMulticast(tokens: string[], notification: PushNotificationData) {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl,
        },
        data: {
          type: notification.type,
          ...notification.data,
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: this.getChannelId(notification.type),
            color: '#1976d2',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendMulticast(message);

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            logger.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
          }
        });

        // Remove invalid tokens
        await this.removeInvalidTokens(failedTokens);
      }

      logger.info(`Sent ${response.successCount}/${tokens.length} messages successfully`);
      return response;
    } catch (error) {
      logger.error('Failed to send multicast message:', error);
      throw error;
    }
  }

  /**
   * Get Android notification channel ID based on type
   */
  private static getChannelId(type: string): string {
    switch (type) {
      case 'recall':
        return 'recalls';
      case 'adverse-event':
        return 'adverse-events';
      default:
        return 'general';
    }
  }

  /**
   * Remove invalid device tokens
   */
  private static async removeInvalidTokens(tokens: string[]) {
    try {
      await db('portal.device_tokens')
        .whereIn('token', tokens)
        .update({ is_active: false, updated_at: new Date() });

      logger.info(`Removed ${tokens.length} invalid tokens`);
    } catch (error) {
      logger.error('Failed to remove invalid tokens:', error);
    }
  }

  /**
   * Register device token
   */
  static async registerDevice(
    userId: string,
    token: string,
    platform: 'ios' | 'android',
    deviceId: string
  ) {
    try {
      // Check if token already exists
      const existing = await db('portal.device_tokens')
        .where({ token })
        .first();

      if (existing) {
        // Update existing token
        await db('portal.device_tokens')
          .where({ token })
          .update({
            user_id: userId,
            platform,
            device_id: deviceId,
            is_active: true,
            updated_at: new Date(),
          });
      } else {
        // Insert new token
        await db('portal.device_tokens').insert({
          user_id: userId,
          token,
          platform,
          device_id: deviceId,
          is_active: true,
        });
      }

      logger.info(`Registered device token for user ${userId}`);
    } catch (error) {
      logger.error('Failed to register device token:', error);
      throw error;
    }
  }

  /**
   * Unregister device token
   */
  static async unregisterDevice(token: string) {
    try {
      await db('portal.device_tokens')
        .where({ token })
        .update({ is_active: false, updated_at: new Date() });

      logger.info('Unregistered device token');
    } catch (error) {
      logger.error('Failed to unregister device token:', error);
      throw error;
    }
  }

  /**
   * Send recall notification
   */
  static async sendRecallNotification(recall: any) {
    const notification: PushNotificationData = {
      title: '⚠️ Medicine Recall Alert',
      body: `${recall.medicine_name} has been recalled. Severity: ${recall.severity}`,
      type: 'recall',
      data: {
        recallId: recall.id,
        medicineId: recall.medicine_id,
        severity: recall.severity,
      },
    };

    // Send to all users
    const allDevices = await db('portal.device_tokens')
      .where({ is_active: true });

    const tokens = allDevices.map(d => d.token);
    await this.sendMulticast(tokens, notification);
  }

  /**
   * Send adverse event confirmation
   */
  static async sendAdverseEventConfirmation(userId: string, eventId: string) {
    const notification: PushNotificationData = {
      title: 'Adverse Event Submitted',
      body: 'Your adverse event report has been received and is being reviewed.',
      type: 'adverse-event',
      data: {
        eventId,
      },
    };

    await this.sendToUser(userId, notification);
  }

  /**
   * Send medicine update notification
   */
  static async sendMedicineUpdateNotification(medicine: any) {
    const notification: PushNotificationData = {
      title: 'Medicine Information Updated',
      body: `${medicine.trade_name} information has been updated.`,
      type: 'medicine',
      data: {
        medicineId: medicine.id,
      },
    };

    // Send to users who favorited this medicine (if that feature exists)
    // For now, we'll skip this
  }
}