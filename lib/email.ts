import { render } from '@react-email/components';
import nodemailer from 'nodemailer';
import { AdminCommentNotification } from '../emails/admin-comment-notification';
import { UserCommentNotification } from '../emails/user-comment-notification';

// Email configuration
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER;

// Team email addresses
const TEAM_EMAILS = [
  'andres@moilapp.com',
  'jacob@moilapp.com',
  'taiwo@moilapp.com',
  'steve@moilapp.com'
];

// Create transporter
const createTransporter = () => {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS environment variables.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
};

export interface CalendarItem {
  id: string;
  date: string;
  platform: string[];
  type: string;
  hook: string;
  copy: string;
}

export interface EmailNotificationData {
  clientName: string;
  clientEmail: string;
  comment: string;
  calendarDate: string;
  calendarItem: CalendarItem;
  dashboardUrl: string;
  adminName?: string; // Only present for admin comments
}

export async function sendAdminCommentNotification(data: EmailNotificationData & { adminName: string }) {
  try {
    const transporter = createTransporter();
    
    const emailHtml = await render(
      AdminCommentNotification({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        adminName: data.adminName,
        comment: data.comment,
        calendarDate: data.calendarDate,
        calendarItem: data.calendarItem,
        dashboardUrl: data.dashboardUrl,
      })
    );

    const options = {
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `Admin Comment: ${data.adminName} commented on ${data.clientName}'s calendar (${data.calendarDate})`,
      html: emailHtml,
    };

    const result = await transporter.sendMail(options);
    console.log('Admin comment notification sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending admin comment notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendUserCommentNotification(data: EmailNotificationData) {
  try {
    const transporter = createTransporter();
    
    const emailHtml = await render(
      UserCommentNotification({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        comment: data.comment,
        calendarDate: data.calendarDate,
        calendarItem: data.calendarItem,
        dashboardUrl: data.dashboardUrl,
      })
    );

    const options = {
      from: FROM_EMAIL,
      to: TEAM_EMAILS,
      subject: `New Comment: ${data.clientName} commented on calendar item (${data.calendarDate})`,
      html: emailHtml,
    };

    const result = await transporter.sendMail(options);
    console.log('User comment notification sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending user comment notification:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function testEmailConfiguration() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    console.error('Email configuration test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
