import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Heading,
  Preview,
} from '@react-email/components';

interface AdminCommentNotificationProps {
  clientName: string;
  clientEmail: string;
  adminName: string;
  comment: string;
  calendarDate: string;
  calendarItem: {
    platform: string[];
    type: string;
    hook: string;
    copy: string;
  };
  dashboardUrl: string;
}

export function AdminCommentNotification({
  clientName,
  clientEmail,
  adminName,
  comment,
  calendarDate,
  calendarItem,
  dashboardUrl,
}: AdminCommentNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Admin comment from {adminName} on {clientName}'s calendar item</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={h1}>MOIL Calendar - Admin Comment</Heading>
          </Section>
          
          <Section style={content}>
            <Text style={paragraph}>
              <strong>{adminName}</strong> (Admin) left a comment on <strong>{clientName}'s</strong> calendar item for <strong>{calendarDate}</strong>.
            </Text>
            
            <Section style={commentSection}>
              <Text style={commentLabel}>Comment:</Text>
              <Text style={commentText}>"{comment}"</Text>
            </Section>
            
            <Hr style={hr} />
            
            <Section style={calendarDetails}>
              <Text style={detailsLabel}>Calendar Item Details:</Text>
              <Text style={detailItem}><strong>Date:</strong> {calendarDate}</Text>
              <Text style={detailItem}><strong>Platform:</strong> {calendarItem.platform.join(', ')}</Text>
              <Text style={detailItem}><strong>Type:</strong> {calendarItem.type}</Text>
              <Text style={detailItem}><strong>Hook:</strong> {calendarItem.hook}</Text>
              <Text style={detailItem}><strong>Copy:</strong> {calendarItem.copy.substring(0, 100)}{calendarItem.copy.length > 100 ? '...' : ''}</Text>
            </Section>
            
            <Section style={buttonContainer}>
              <Button href={dashboardUrl} style={button}>
                View Calendar Item
              </Button>
            </Section>
            
            <Hr style={hr} />
            
            <Text style={footer}>
              This is an automated notification from MOIL Calendar.<br />
              Client: {clientName} ({clientEmail})
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const header = {
  padding: '32px 24px',
  backgroundColor: '#667eea',
  borderRadius: '8px 8px 0 0',
};

const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  textAlign: 'center' as const,
};

const content = {
  padding: '24px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#374151',
  margin: '0 0 16px',
};

const commentSection = {
  backgroundColor: '#f3f4f6',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
  borderLeft: '4px solid #f59e0b',
};

const commentLabel = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#374151',
  margin: '0 0 8px',
};

const commentText = {
  fontSize: '16px',
  color: '#1f2937',
  fontStyle: 'italic',
  margin: '0',
  lineHeight: '1.5',
};

const calendarDetails = {
  backgroundColor: '#f9fafb',
  padding: '16px',
  borderRadius: '8px',
  margin: '16px 0',
};

const detailsLabel = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#374151',
  margin: '0 0 12px',
};

const detailItem = {
  fontSize: '14px',
  color: '#6b7280',
  margin: '0 0 8px',
  lineHeight: '1.4',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#667eea',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.4',
  textAlign: 'center' as const,
  margin: '32px 0 0',
};
