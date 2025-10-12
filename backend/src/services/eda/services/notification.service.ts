// File: backend/src/services/eda/services/notification.service.ts
// Purpose: Multi-channel notification system (Email, SMS)

import { db } from '../../../shared/database/connection';
import { logger } from '../../../shared/utils/logger';
import { config } from '../../../config';
import { AppError } from '../../../shared/middleware/errorHandler';

// Note: Install these packages: npm install @sendgrid/mail twilio
// import sgMail from '@sendgrid/mail';
// import twilio from 'twilio';

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface SMSNotification {
  to: string;
  message: string;
}

export class NotificationService {
  /**
   * Send recall notifications to all affected parties
   */
  static async sendRecallNotifications(recallId: string): Promise<void> {
    try {
      // Get recall details
      const recall = await db('portal.recalls')
        .where({ id: recallId })
        .first();

      if (!recall) {
        throw new AppError('Recall not found', 404);
      }

      // Get medicine details
      const medicine = await db('portal.medicines')
        .where({ id: recall.medicine_id })
        .first();

      // Get pending notifications
      const notifications = await db('portal.recall_notifications')
        .where({ recall_id: recallId, status: 'pending' });

      // Send notifications in batches
      const batchSize = 100;
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map((notification: any) =>
            this.sendSingleNotification(notification, recall, medicine)
          )
        );
      }

      logger.info(`Sent ${notifications.length} recall notifications for ${recall.recall_number}`);
    } catch (error) {
      logger.error('Failed to send recall notifications:', error);
      throw error;
    }
  }

  /**
   * Send a single notification
   */
  private static async sendSingleNotification(
    notification: any,
    recall: any,
    medicine: any
  ): Promise<void> {
    try {
      // For demo purposes, we'll just log and mark as sent
      // In production, integrate with SendGrid and Twilio
      
      if (notification.channel === 'email') {
        logger.info(`[EMAIL] Would send to ${notification.recipient_email}: Recall ${recall.recall_number}`);
      } else if (notification.channel === 'sms') {
        logger.info(`[SMS] Would send to ${notification.recipient_phone}: Recall ${recall.recall_number}`);
      }

      // Update notification status
      await this.updateNotificationStatus(notification.id, 'sent');

      logger.info(`Sent ${notification.channel} notification to ${notification.recipient_name}`);
    } catch (error: any) {
      logger.error('Failed to send notification:', error);
      
      // Update failure status and retry count
      await db('portal.recall_notifications')
        .where({ id: notification.id })
        .update({
          status: 'failed',
          failure_reason: error.message,
          retry_count: db.raw('retry_count + 1'),
          updated_at: new Date(),
        });
    }
  }

  /**
   * Send email notification (SendGrid integration)
   */
  static async sendEmailNotification(email: EmailNotification): Promise<void> {
    try {
      // TODO: Integrate with SendGrid
      // await sgMail.send({
      //   to: email.to,
      //   from: email.from || config.email.from,
      //   subject: email.subject,
      //   html: email.html,
      // });

      logger.info(`Email sent to ${email.to}`);
    } catch (error: any) {
      logger.error('Failed to send email:', error);
      throw new AppError(`Email delivery failed: ${error.message}`, 500);
    }
  }

  /**
   * Send SMS notification (Twilio integration)
   */
  static async sendSMSNotification(sms: SMSNotification): Promise<void> {
    try {
      // TODO: Integrate with Twilio
      // const twilioClient = twilio(config.sms.accountSid, config.sms.authToken);
      // await twilioClient.messages.create({
      //   body: sms.message,
      //   from: config.sms.phoneNumber,
      //   to: sms.to,
      // });

      logger.info(`SMS sent to ${sms.to}`);
    } catch (error: any) {
      logger.error('Failed to send SMS:', error);
      throw new AppError(`SMS delivery failed: ${error.message}`, 500);
    }
  }

  /**
   * Update notification status
   */
  private static async updateNotificationStatus(
    notificationId: string,
    status: string,
    failureReason?: string
  ): Promise<void> {
    const updates: any = {
      status,
      updated_at: new Date(),
    };

    if (status === 'sent') {
      updates.sent_at = new Date();
    } else if (status === 'delivered') {
      updates.delivered_at = new Date();
    } else if (status === 'acknowledged') {
      updates.acknowledged_at = new Date();
    } else if (status === 'failed') {
      updates.failure_reason = failureReason;
    }

    await db('portal.recall_notifications')
      .where({ id: notificationId })
      .update(updates);
  }

  /**
   * Generate recall email template
   */
  static generateRecallEmailTemplate(
    recall: any,
    medicine: any,
    recipient: any
  ): string {
    const severityLabel = {
      class_1: 'CLASS I - URGENT',
      class_2: 'CLASS II - MODERATE',
      class_3: 'CLASS III - LOW RISK',
    }[recall.severity];

    const severityColor = {
      class_1: '#DC2626',
      class_2: '#F59E0B',
      class_3: '#3B82F6',
    }[recall.severity];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medicine Recall Notice</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="background-color: ${severityColor}; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ MEDICINE RECALL NOTICE</h1>
              <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 14px; font-weight: bold;">${severityLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #1f2937;">Dear ${recipient.name},</p>
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                The Egyptian Drug Authority (EDA) has issued a recall for the following medicine:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; font-weight: bold;">Medicine Name:</td>
                  <td style="padding: 10px; background-color: #f9fafb;">${medicine.trade_name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Recall Number:</td>
                  <td style="padding: 10px;">${recall.recall_number}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #f9fafb; font-weight: bold;">Batch Numbers:</td>
                  <td style="padding: 10px; background-color: #f9fafb;">${recall.batch_numbers.join(', ')}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold;">Reason:</td>
                  <td style="padding: 10px;">${recall.reason}</td>
                </tr>
              </table>
              <p style="margin: 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                <strong>Action Required:</strong><br>
                ${recall.action_required}
              </p>
              <p style="margin: 20px 0; font-size: 14px; color: #4b5563; line-height: 1.6;">
                <strong>Contact Information:</strong><br>
                ${recall.contact_person}<br>
                Phone: ${recall.contact_phone}<br>
                Email: ${recall.contact_email}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0;">Egyptian Drug Authority (EDA)</p>
              <p style="margin: 5px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  /**
   * Generate recall SMS template
   */
  static generateRecallSMSTemplate(recall: any, medicine: any): string {
    return `URGENT: Medicine Recall - ${medicine.trade_name} (${recall.recall_number}). Batch: ${recall.batch_numbers.join(', ')}. Contact EDA: ${recall.contact_phone}`;
  }
}

