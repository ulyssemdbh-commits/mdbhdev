# REV (Retour En Ville)

## Overview

REV is a local commerce cashback platform designed for French markets. It connects customers with local merchants through a QR-code-based loyalty system where customers earn 10% cashback on purchases that can be used across the merchant network.

The application has three user roles:
- **Clients** - Consumers who scan QR codes to earn and use cashback at partner merchants
- **Commerçants (Merchants)** - Local business owners who scan customer QR codes to process transactions
- **Admins** - Platform administrators who manage merchants and track commissions

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Build Tool**: Vite with custom Replit plugins

The frontend uses a role-based routing system where authenticated users are directed to their appropriate dashboard (client, merchant, or admin) based on their user role.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Pattern**: RESTful endpoints under `/api/` prefix
- **Authentication**: Email/password with Passport.js Local Strategy + bcryptjs
- **Session Management**: Express sessions stored in PostgreSQL via connect-pg-simple

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)

Key database tables:
- `users` - User accounts with role-based access (client/merchant/admin)
- `merchants` - Business profiles linked to user accounts
- `transactions` - Purchase records with cashback calculations
- `cashback_balances` - Per-user, per-merchant balance tracking
- `cashback_entries` - Individual cashback earning/spending records
- `sessions` - Authentication session storage

### Authentication Flow
Uses email/password authentication with Passport.js Local Strategy. Passwords are hashed with bcryptjs (12 rounds). Users register with email + password and receive a unique REVid. Session data is persisted in PostgreSQL for reliability. Admin account: djedoumaurice@gmail.com / Admin123!

### Build System
- Development: Vite dev server with HMR proxied through Express
- Production: Vite builds static assets, esbuild bundles server code
- Output: Single `dist/` folder with `public/` subfolder for static files

## External Dependencies

### Third-Party Services
- **Stripe**: Payment processing for gift cards
- **PayPal**: Alternative payment for gift cards
- **PostgreSQL**: Database (provisioned via Replit)

### Key npm Packages
- `drizzle-orm` / `drizzle-kit` - Database ORM and migrations
- `passport` / `passport-local` / `bcryptjs` - Authentication
- `react-qr-code` / `@zxing/library` - QR code generation and scanning
- `jspdf` / `jspdf-autotable` - PDF report generation
- `date-fns` - Date formatting for French locale

### Frontend Component Libraries
- `@radix-ui/*` - Accessible UI primitives
- `shadcn/ui` - Pre-styled component library (new-york style)
- `lucide-react` - Icon library