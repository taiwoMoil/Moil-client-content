# Email Configuration

To enable email notifications for comments, you need to set up the following environment variables in your `.env.local` file:

## Required Environment Variables

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# From Email (optional, defaults to SMTP_USER)
FROM_EMAIL=noreply@moilapp.com

# Site URL for email links
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Gmail Setup Instructions

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this password as `SMTP_PASS`

## Other Email Providers

### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
```

### Yahoo
```bash
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
```

### Custom SMTP
```bash
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587  # or 465 for SSL
```

## Email Recipients

The system automatically sends notifications to the MOIL team:
- andres@moilapp.com
- jacob@moilapp.com
- taiwo@moilapp.com
- steve@moilapp.com

## Email Templates

Two email templates are available:

1. **Admin Comment Notification**: Sent when an admin comments on a client's calendar item
2. **User Comment Notification**: Sent when a user comments on their own calendar item

Both templates include:
- Comment content
- Calendar item details (date, platform, type, hook, copy preview)
- Link to view the calendar item
- Client information
