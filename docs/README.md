SMART Website Repository

Overview
This repository contains the complete codebase for the SMART (Systematic Monitoring and Responsive Treatment) Website, a comprehensive platform for healthcare management. The project is built with modern web technologies including Next.js (React), TypeScript, and Tailwind CSS.

Folder Structure
SMART-Website/
├── app/                   # Next.js Application Core
│   ├── admin/             # Admin Dashboard (authenticated)
│   ├── clinic/            # Clinic Management Area (authenticated)
│   ├── user/              # User-facing applications (authenticated)
│   ├── patient/           # Patient Portals (authenticated)
│   ├── auth/              # Authentication flows (login, register, etc.)
│   ├── api/               # Backend API Routes (Next.js API Routes)
│   ├── components/        # Reusable UI Components
│   │   ├── ui/            # Generic UI primitives (shadcn/ui)
│   │   ├── admin/         # Admin specific components
│   │   └── layouts/       # Layout components (Sidebar, Header, etc.)
│   ├── lib/               # Utility functions and helpers
│   ├── public/            # Static assets
│   └── styles/            # Global styles and Tailwind config
├── database/              # Database schemas and migration scripts
├── scripts/               # Automation and utility scripts
├── services/              # Service layer and business logic
├── tests/                 # Test files
├── .env.example           # Environment variable template
├── next.config.js         # Next.js configuration
├── package.json           # Project dependencies
└── README.md              # Project documentation
Key Technologies
Framework: Next.js 14+ (React 18+)
Language: TypeScript
Styling: Tailwind CSS, shadcn/ui (Component Library)
Data Fetching: Next.js Server Components, SWR (optional)
UI/UX Framework: Material UI (MUI) - Forms, Tables, Dialogs
State Management: Zustand
Authentication: NextAuth.js (Auth.js) - Optional, or custom
Environment Variables
Create a .env file based on .env.example:

NPM_CONFIG_USERAGENT=npm/9.6.1 node/v18.16.0 linux/5.15.0-76-generic
HOST=localhost
PORT=3000
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000/api
AUTH_SECRET=your-secret-key  # Generate securely
AUTH_URL=http://localhost:3000/api/auth  # Verify
Database Configuration:

DB_HOST=localhost
DB_PORT=5432
DB_NAME=smart_db
DB_USER=smart_user
DB_PASSWORD=smart_password
Getting Started
Prerequisites
Node.js (LTS version recommended)
npm (or yarn/pnpm)
PostgreSQL Database
Setup Instructions
Clone the repository:

git clone <repository-url>
cd SMART-Website
Install dependencies:

npm install
Configure environment variables:

cp .env.example .env
# Edit .env with your specific configuration
Run database migrations (if applicable):

npm run db:migrate
Start the development server:

npm run dev
Access the application:

Admin Dashboard: http://localhost:3000/admin
Clinic: http://localhost:3000/clinic
Patient: http://localhost:3000/patient
User: http://localhost:3000/user
Authentication: http://localhost:3000/auth
Default Credentials (if using seed):

Admin: admin@admin.com / password123
Clinic: [EMAIL_ADDRESS] / password123
User: [EMAIL_ADDRESS] / password123
Patient: [EMAIL_ADDRESS] / password123
Production Build
For production:

Build the application:

npm run build
Start the production server:

npm run start
File Descriptions
app/admin/: Admin-specific pages, dashboards, and management tools.
app/clinic/: Pages for clinic management, appointment scheduling, and staff management.
app/user/: Portal for general users and staff interactions.
app/patient/: Separate portal for patients to view records, appointments, and manage their care.
app/auth/: Authentication flows including login, register, forgot password.
app/api/: Next.js API routes that act as backend endpoints.
app/components/: Reusable React components organized by type.
components/ui/: General UI components from shadcn/ui library.
components/admin/: Admin-specific UI components.
components/layouts/: Navigation, sidebars, headers, and page layouts.
lib/: Helper functions for API calls, validation, formatting, etc.
database/: Database schemas, models, and migration scripts.
services/: Business logic layer and service functions.
scripts/: Automation scripts for database, deployment, etc.
Testing
Run tests:

npm run test
Run TypeScript type checking:

npm run type-check  


M:\Milan Baskota\Git\SMART-Website>firebase deploy --only hosting:smartinstitute
