// Pre-configured users for Ruino General Merchants
export interface PreConfiguredUser {
  name: string;
  email: string;
  role: 'admin' | 'cashier';
  initials: string;
}

export const PRECONFIGURED_USERS: PreConfiguredUser[] = [
  { name: 'CEO', email: 'ceo@ruino.local', role: 'admin', initials: 'CEO' },
  { name: 'MD', email: 'md@ruino.local', role: 'admin', initials: 'MD' },
  { name: 'Irungu', email: 'irungu@ruino.local', role: 'admin', initials: 'IR' },
  { name: 'Muiruri', email: 'muiruri@ruino.local', role: 'cashier', initials: 'MU' },
  { name: 'Gakwa', email: 'gakwa@ruino.local', role: 'cashier', initials: 'GK' },
];

// Default password for all users (simplified for POS environment)
export const DEFAULT_PASSWORD = 'ruino2024';
