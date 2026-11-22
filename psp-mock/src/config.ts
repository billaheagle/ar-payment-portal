export interface PspConfig {
  port: number;
  publicUrl: string;
  apiKey: string;
  webhookUrl: string;
  webhookSecret: string;
  checkoutTtlSeconds: number;
}

const positiveInt = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Invalid ${name}: ${raw}`);
  return value;
};

export const loadConfig = (): PspConfig => ({
  port: positiveInt('PSP_PORT', 4005),
  publicUrl: process.env.PSP_PUBLIC_URL ?? 'http://localhost:4005',
  apiKey: process.env.PSP_API_KEY ?? 'psp_test_key',
  webhookUrl: process.env.PSP_WEBHOOK_URL ?? 'http://localhost:4004/webhooks/psp',
  webhookSecret: process.env.PSP_WEBHOOK_SECRET ?? 'whsec_test_123',
  checkoutTtlSeconds: positiveInt('PSP_CHECKOUT_TTL_SECONDS', 1800),
});
