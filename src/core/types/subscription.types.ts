export type SubscriptionCategory = 'work' | 'personal' | 'saas' | 'streaming' | 'utility' | 'other';
export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'custom';
export type SubscriptionStatus = 'active' | 'trial' | 'canceling' | 'paused' | 'canceled';
export type DueUrgency = 'overdue' | 'today' | 'urgent' | 'soon' | 'safe';

export interface CustomCategory {
  value: string;  // unique slug, e.g. 'gaming'
  label: string;  // display name, e.g. 'Gaming'
  emoji: string;  // e.g. '🎮'
  color: string;  // hex, e.g. '#3b82f6'
}

export interface Subscription {
  id: string;
  name: string;
  logo?: string;
  url?: string;
  email?: string;
  category: string; // SubscriptionCategory or any custom category value
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string; // ISO date (YYYY-MM-DD)
  paymentMethod?: string;
  status: SubscriptionStatus;
  reminder: number; // days before renewal to remind
  notes?: string;
  tags?: string[];
  createdAt: string; // ISO timestamp
}

export interface SubscriptionTemplate {
  name: string;
  url?: string;
  category: string;
  defaultPrice: number;
  currency: string;
  billingCycle: BillingCycle;
}

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'INR', 'BRL', 'MXN',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
];

export const CATEGORY_LABELS: Record<string, string> = {
  work: 'Work',
  personal: 'Personal',
  saas: 'SaaS',
  streaming: 'Streaming',
  utility: 'Utility',
  other: 'Other',
};

export const CATEGORY_COLORS: Record<string, string> = {
  work: '#3b82f6',
  personal: '#ec4899',
  saas: '#8b5cf6',
  streaming: '#f59e0b',
  utility: '#10b981',
  other: '#6b7280',
};

export const SUBSCRIPTION_TEMPLATES: SubscriptionTemplate[] = [
  { name: 'Netflix',             url: 'https://netflix.com',           category: 'streaming', defaultPrice: 15.99, currency: 'USD', billingCycle: 'monthly' },
  { name: 'Spotify',             url: 'https://spotify.com',           category: 'streaming', defaultPrice: 9.99,  currency: 'USD', billingCycle: 'monthly' },
  { name: 'YouTube Premium',     url: 'https://youtube.com',           category: 'streaming', defaultPrice: 13.99, currency: 'USD', billingCycle: 'monthly' },
  { name: 'Disney+',             url: 'https://disneyplus.com',        category: 'streaming', defaultPrice: 7.99,  currency: 'USD', billingCycle: 'monthly' },
  { name: 'Apple One',           url: 'https://apple.com',             category: 'streaming', defaultPrice: 19.95, currency: 'USD', billingCycle: 'monthly' },
  { name: 'Figma',               url: 'https://figma.com',             category: 'saas',      defaultPrice: 15,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'GitHub Copilot',      url: 'https://github.com',            category: 'saas',      defaultPrice: 10,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'ChatGPT Plus',        url: 'https://chat.openai.com',       category: 'saas',      defaultPrice: 20,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Notion',              url: 'https://notion.so',             category: 'saas',      defaultPrice: 10,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Adobe Creative Cloud',url: 'https://adobe.com',             category: 'saas',      defaultPrice: 54.99, currency: 'USD', billingCycle: 'monthly' },
  { name: 'Microsoft 365',       url: 'https://microsoft.com',         category: 'saas',      defaultPrice: 99.99, currency: 'USD', billingCycle: 'yearly' },
  { name: 'Vercel Pro',          url: 'https://vercel.com',            category: 'saas',      defaultPrice: 20,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Supabase Pro',        url: 'https://supabase.com',          category: 'saas',      defaultPrice: 25,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Linear',              url: 'https://linear.app',            category: 'work',      defaultPrice: 8,     currency: 'USD', billingCycle: 'monthly' },
  { name: 'Slack',               url: 'https://slack.com',             category: 'work',      defaultPrice: 7.25,  currency: 'USD', billingCycle: 'monthly' },
  { name: 'AWS',                 url: 'https://aws.amazon.com',        category: 'utility',   defaultPrice: 50,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Cloudflare',          url: 'https://cloudflare.com',        category: 'utility',   defaultPrice: 20,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'DigitalOcean',        url: 'https://digitalocean.com',      category: 'utility',   defaultPrice: 12,    currency: 'USD', billingCycle: 'monthly' },
  { name: 'Google One',          url: 'https://one.google.com',        category: 'utility',   defaultPrice: 2.99,  currency: 'USD', billingCycle: 'monthly' },
  { name: 'Dropbox',             url: 'https://dropbox.com',           category: 'utility',   defaultPrice: 9.99,  currency: 'USD', billingCycle: 'monthly' },
  { name: '1Password',           url: 'https://1password.com',         category: 'utility',   defaultPrice: 2.99,  currency: 'USD', billingCycle: 'monthly' },
  { name: 'LastPass',            url: 'https://lastpass.com',          category: 'utility',   defaultPrice: 3,     currency: 'USD', billingCycle: 'monthly' },
];
