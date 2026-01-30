// Pre-configured users for Ruinu General Merchants
export interface PreConfiguredUser {
  name: string;
  email: string;
  role: 'admin' | 'cashier';
  initials: string;
}

export const PRECONFIGURED_USERS: PreConfiguredUser[] = [
  { name: 'CEO', email: 'ceo@ruinu.local', role: 'admin', initials: 'CEO' },
  { name: 'MD', email: 'md@ruinu.local', role: 'admin', initials: 'MD' },
  { name: 'Irungu', email: 'irungu@ruinu.local', role: 'admin', initials: 'IR' },
  { name: 'Muiruri', email: 'muiruri@ruinu.local', role: 'cashier', initials: 'MU' },
  { name: 'Gakwa', email: 'gakwa@ruinu.local', role: 'cashier', initials: 'GK' },
];

// Default password for all users (simplified for POS environment)
export const DEFAULT_PASSWORD = 'ruinu2024';
