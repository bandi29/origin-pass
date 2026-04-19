import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import fs from "fs"
import path from "path"

const withNextIntl = createNextIntlPlugin();

const loadEnvLocal = () => {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [key, ...rest] = trimmed.split('=');
    const value = rest.join('=').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    process.env[key] = value;
  });
};

loadEnvLocal();

/** 8 MiB — Next 16 types `bodySizeLimit` as byte count (number), not string. */
const EIGHT_MB = 8 * 1024 * 1024

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: EIGHT_MB,
    },
  },
}

export default withNextIntl(nextConfig)
