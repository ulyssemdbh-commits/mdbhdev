# Design Guidelines: REV (Retour En Ville)

## Design Approach
**System-Based Approach** using modern fintech/mobile app principles. REV requires clear information hierarchy, mobile optimization, and trustworthy presentation suitable for financial transactions. The design takes inspiration from successful European fintech apps (Lydia, N26) with French market sensibilities.

## Core Design Principles
1. **Mobile-First**: All interfaces optimized for smartphone use (QR scanning, on-the-go)
2. **Trust & Clarity**: Clean, professional aesthetic that conveys financial security
3. **Role-Based Design**: Distinct visual hierarchies for Client, Commerçant, and Admin interfaces
4. **Scannable Information**: Large touch targets, high contrast for outdoor/retail use

## Typography

**Font Family**: 
- Primary: Inter (via Google Fonts) - clean, modern, excellent French character support
- Weights: 400 (regular), 600 (semibold), 700 (bold)

**Type Scale**:
- Hero/Display: text-4xl (36px) / font-bold
- Page Headers: text-2xl (24px) / font-bold  
- Section Headers: text-xl (20px) / font-semibold
- Card Titles: text-lg (18px) / font-semibold
- Body Text: text-base (16px) / font-normal
- Secondary/Meta: text-sm (14px) / font-normal
- Labels: text-xs (12px) / font-medium uppercase tracking-wide

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8  
- Card gaps: gap-4
- Generous touch targets: min-h-12 for buttons

**Container Strategy**:
- Mobile: max-w-lg (all interfaces)
- Padding: px-4 (consistent edge margins)
- Full-bleed elements: QR codes, "Bons Plans" cards

## Component Library

### Client Interface Components

**QR Code Display** (Hero Element):
- Large, centered QR code (w-64 h-64)
- Card background with generous padding (p-8)
- User name/ID below QR
- "Présentez ce code en caisse" instruction text
- Subtle shadow for depth

**Navigation Tabs** (Primary):
- Three equal-width tabs: "Bons Plans" | "Mes partREV" | "Mon Compte"
- Active state: border-b-2 with accent color
- Icon + label for each tab
- Sticky positioning at top

**Balance Card** (Mon Compte):
- Split display: "Disponible" (large, prominent) | "En attente" (secondary)
- Amount in text-3xl, currency symbol smaller
- Unlock countdown for pending amount
- Gradient or subtle background treatment

**Transaction List**:
- Merchant name (bold) + amount (right-aligned)
- Status badge (Gagné/Utilisé/En attente) with color coding
- Date/time in small gray text
- Dividers between items

**Bons Plans Cards**:
- Full-width cards with merchant photo/logo
- Offer title (bold), description (2 lines max)
- Merchant name + category badge
- "Voir l'offre" CTA button
- Grid layout (1 column mobile)

**Mes partREV Directory**:
- Search bar (sticky, top of section)
- Filter chips: "Tous" | "Alimentation" | "Santé" | "Services" | "À proximité"
- Merchant cards: logo, name, category, distance, checkmark if visited
- Alphabetical or distance sorting toggle

### Commerçant Interface Components

**QR Scanner View**:
- Full-screen camera viewfinder
- Centered square scan frame with animated corners
- "Scannez le QR code client" instruction overlay
- Manual entry button (bottom)

**Transaction Entry Form**:
- Client name/ID (read-only, from QR scan)
- Large numeric input for amount (text-4xl)
- Currency symbol (€) fixed right
- Calculated cashback preview (10% in green)
- "Valider la transaction" primary button (full-width)

**Transaction History** (Commerçant):
- Client name + cashback amount generated
- Transaction timestamp
- Status indicator
- Weekly commission summary card (sticky top)

**Commission Dashboard**:
- Current week total (large)
- Breakdown: transactions count, total sales, 13% commission due
- Historical weekly chart (simple bars)

### REV Admin Interface Components

**Statistics Dashboard**:
- KPI cards grid (2 columns): Total transactions, Active merchants, Total cashback, Commissions
- Growth indicators (↑ percentage)
- Transaction volume graph
- Recent activity feed

**Merchant Management Table**:
- Search/filter bar
- Merchant list: name, status (active/pending), join date, total sales
- Action buttons: validate, edit, view details
- Pack subscription indicator (Bons Plans badge)

## Images

**Merchant Photos**: 
- Required for "Bons Plans" cards (3:2 aspect ratio, rounded corners)
- Optional for "Mes partREV" listings (small circle logos/photos)

**No Hero Images**: All interfaces are dashboard/utility focused. Primary visual element is the client's QR code.

## Interaction Patterns

**Buttons**:
- Primary: Full-width on mobile, rounded-lg, py-3
- Secondary: Outline variant
- Scan button: Floating action button (bottom-right) with camera icon
- Disabled states: 50% opacity

**Status Indicators**:
- Gagné (earned): green badge
- En attente (pending): amber/orange badge
- Utilisé (used): gray badge
- Annulé (cancelled): red badge

**Notifications**:
- Toast messages (top): transaction confirmations
- Inline alerts: validation errors, success messages
- Push notification integration for transaction confirmations

**Loading States**:
- Skeleton screens for lists
- Spinner for form submissions
- Progressive loading for transaction history

## Accessibility

- Minimum 44x44px touch targets
- High contrast ratios (WCAG AA)
- Clear focus indicators for keyboard navigation
- French language labels and ARIA attributes
- Error messages in plain French

## Mobile Optimization

- Bottom navigation for Client interface
- Swipe gestures for transaction history
- Camera permissions handling with clear instructions
- Offline mode indicators
- Optimized for one-handed use (important actions in thumb zone)