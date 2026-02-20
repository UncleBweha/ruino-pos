# Ruinu POS - General Merchants

Ruinu POS is a fast and reliable retail management point-of-sale system designed for Ruinu General Merchants.

## Features

- **Inventory Management**: Track stock levels and product details.
- **Sales & Billing**: Fast checkout process with automated invoice generation.
- **Customer Management**: Maintain customer records and purchase history.
- **Supplier Tracking**: Manage supplier relationships and supplies.
- **Reports & Analytics**: Insights into business performance.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Database, Auth, Edge Functions)
- **Deployment**: Can be deployed to any static hosting provider (Vercel, Netlify, etc.) with Supabase backend.

## Getting Started

### Prerequisites

- Node.js & npm installed

### Installation

1. Clone the repository:
   ```sh
   git clone <YOUR_GIT_URL>
   ```
2. Navigate to the project directory:
   ```sh
   cd ruino-pos
   ```
3. Install dependencies:
   ```sh
   npm install
   ```
4. Start the development server:
   ```sh
   npm run dev
   ```

## Configuration

Ensure you have your `.env` file set up with the necessary Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment

Build the project for production:

```sh
npm run build
```

Then deploy the `dist` folder to your preferred hosting platform.
