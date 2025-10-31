# Moil Calendar - Multi-Client Content Management Platform

A Next.js application for managing content calendars across multiple clients with Supabase authentication and database integration. Each client gets a personalized dashboard with their own branding and content.

## Features

- 🔐 **Authentication**: Login/Signup with Supabase Auth
- 🏢 **Multi-Client Support**: Manage multiple clients with personalized branding
- 📅 **Content Calendar**: Interactive calendar management per client
- 🎨 **Custom Branding**: Each client gets their own colors and styling
- 👥 **Team Workflow**: Track team and client status
- 💬 **Comments**: Add comments to calendar items
- 📋 **Copy to Clipboard**: Easy caption copying
- 🔄 **Real-time Updates**: Live status updates
- 📱 **Responsive Design**: Mobile-friendly interface
- 🏷️ **Industry-Specific**: Tailored content based on client industry

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth + Database)
- **UI Components**: Lucide React icons
- **Styling**: Tailwind CSS with custom design system

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Supabase account and project

### 1. Clone and Install

```bash
git clone <your-repo>
cd saas-starter
npm install
```

### 2. Environment Setup

Copy the environment template:
```bash
cp env.example .env.local
```

Update `.env.local` with your Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL commands from `database/schema.sql`

This will create:
- `clients` table (for multi-client support)
- `users` table (extends Supabase auth with client relationships)
- `content_calendars` table (linked to clients)
- Row Level Security policies
- Triggers for user creation and timestamps

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - you'll be redirected to the login page.

### 5. Seed Sample Clients

```bash
npx tsx scripts/seed-clients.ts
```

This creates sample clients including:
- Rosales Yard Maintenance (Landscaping)
- Tech Solutions Inc (Technology)
- Fitness Plus Studio (Fitness)
- Food Delights Restaurant (Food)
- Creative Agency Co (Marketing)

### 6. Create Your First User

1. Go to `/signup` to create an account
2. Check your email for verification (if email confirmation is enabled)
3. Assign the user to a client in the database:
   ```sql
   UPDATE users SET client_id = 'CLIENT_ID_HERE' WHERE email = 'user@example.com';
   ```
4. Login and access the personalized dashboard

## Project Structure

```
saas-starter/
├── app/
│   ├── api/calendar/          # API routes for calendar operations
│   ├── dashboard/             # Main dashboard page
│   ├── login/                 # Login page
│   ├── signup/                # Signup page
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page (redirects to login)
├── components/ui/             # Reusable UI components
├── lib/
│   ├── supabase/             # Supabase client configuration
│   ├── types/                # TypeScript type definitions
│   └── utils.ts              # Utility functions
├── database/
│   └── schema.sql            # Database schema
├── scripts/
│   └── seed-calendar.ts      # Calendar data seeding script
└── middleware.ts             # Authentication middleware
```

## Key Features

### Authentication Flow
- Protected routes with middleware
- Automatic redirects for unauthenticated users
- Session management with Supabase

### Calendar Management
- View all calendar items in a table format
- Update team and client status via dropdowns
- Add comments to calendar items
- Copy captions to clipboard
- Real-time status dashboard

### Database Schema
- **clients**: Client organizations with branding and industry info
- **users**: User profiles linked to Supabase auth and assigned to clients
- **content_calendars**: Calendar items with status tracking, linked to specific clients

## API Endpoints

- `GET /api/calendar` - Fetch user's calendar items
- `POST /api/calendar` - Create new calendar item
- `PATCH /api/calendar/[id]` - Update calendar item
- `DELETE /api/calendar/[id]` - Delete calendar item

## Customization

### Adding Calendar Data
1. Use the seeding script in `scripts/seed-calendar.ts`
2. Replace `USER_ID_HERE` with an actual user ID
3. Run: `npx tsx scripts/seed-calendar.ts`

### Client Branding
- Each client has their own brand color stored in the database
- The `ClientBranding` component automatically applies client colors
- Industry-specific icons and messaging are displayed
- Headers and themes adapt to each client's branding

### Styling
- Modify Tailwind classes in components
- Update the color scheme in component files
- Client-specific colors are applied dynamically via CSS variables

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms
Ensure your platform supports:
- Node.js 18+
- Environment variables
- Next.js 16 features

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
1. Check the GitHub issues
2. Review Supabase documentation
3. Check Next.js documentation

## License

[Add your license here]
