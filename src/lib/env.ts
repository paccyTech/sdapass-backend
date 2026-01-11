const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
  SMS_API_KEY: string;
  CORS_ORIGIN: string;
  PRIMARY_ORIGIN: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
  GMAIL_FROM_NAME?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
};

const DEFAULT_ORIGIN = "http://localhost:3000";

const parseOrigins = (value: string): string[] =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const parsedOrigins = parseOrigins(process.env.CORS_ORIGIN ?? DEFAULT_ORIGIN);

export const env: Env = {
  // Required
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireEnv("JWT_SECRET"),
  
  // Optional with defaults
  SMS_API_KEY: process.env.SMS_API_KEY ?? "",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? DEFAULT_ORIGIN,
  PRIMARY_ORIGIN: parsedOrigins[0] ?? DEFAULT_ORIGIN,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
  
  // Email configuration
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  GMAIL_FROM_NAME: process.env.GMAIL_FROM_NAME || 'Umuganda SDA',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_SECURE: process.env.SMTP_SECURE || 'false',
};
