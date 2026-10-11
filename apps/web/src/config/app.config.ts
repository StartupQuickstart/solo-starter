import { z } from 'zod';

// KIT CARD: remove this import.
import { KIT_CARD_FLAG } from '@/features/kit-upgrade/kit-flag';

/**
 * The one place the web app's product identity and environment live.
 *
 * Rebranding the client means editing this file, the files in
 * `public/brand/`, and the theme tokens in `src/app/globals.css`. Nothing else
 * in the app spells out a product name, a domain or an email address.
 *
 * Values that differ per deployment come from `NEXT_PUBLIC_*` variables, which
 * Next.js inlines at build time. They are validated here, so a malformed value
 * fails the build (or the dev server's first render) instead of surfacing as
 * a broken link in production.
 */

/** An unset variable and an empty one mean the same thing: use the default. */
const blankAsUnset = (value: unknown): unknown => (value === '' ? undefined : value);

const DEFAULT_APP_NAME = 'Your App';
const DEFAULT_SUPPORT_EMAIL = 'support@example.com';
const DEFAULT_API_URL = 'http://localhost:4000';

const identitySchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.preprocess(blankAsUnset, z.string().min(1).default(DEFAULT_APP_NAME)),
  NEXT_PUBLIC_SUPPORT_EMAIL: z.preprocess(blankAsUnset, z.email().default(DEFAULT_SUPPORT_EMAIL)),
  // KIT CARD: remove this variable.
  NEXT_PUBLIC_SHOW_KIT_CARD: z.preprocess(blankAsUnset, z.enum([KIT_CARD_FLAG.off, KIT_CARD_FLAG.on]).default(KIT_CARD_FLAG.on)),
});

const runtimeSchema = z.object({
  NEXT_PUBLIC_API_URL: z.preprocess(blankAsUnset, z.url().default(DEFAULT_API_URL)),
});

type EnvSource = Readonly<Record<string, string | undefined>>;

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}

function parseOrThrow<T>(schema: z.ZodType<T>, source: EnvSource): T {
  const parsed = schema.safeParse(source);
  if (!parsed.success) throw new Error(`Invalid web app configuration. ${describeIssues(parsed.error)}`);
  return parsed.data;
}

/** A logo image and the size it is drawn at. */
export interface BrandLogo {
  /** For light surfaces (the sign-in and sign-up pages). */
  readonly src: string;
  /** For dark surfaces (the sidebar). */
  readonly srcOnDark: string;
  readonly width: number;
  readonly height: number;
}

export interface AppConfig {
  /** Product name, shown in titles and headings. */
  readonly name: string;
  /** Where people reach a human; shown wherever the app cannot do something itself. */
  readonly supportEmail: string;
  /**
   * KIT CARD: remove this setting.
   * Whether the application kit card (the foot of the sidebar) and the
   * /upgrade page are part of this build. On unless NEXT_PUBLIC_SHOW_KIT_CARD is 0.
   */
  readonly showKitCard: boolean;
  readonly logo: BrandLogo;
}

/**
 * Build the product identity from environment values.
 *
 * @param source - Values of the `NEXT_PUBLIC_*` identity variables.
 * @throws Error naming every invalid variable.
 */
export function parseAppConfig(source: EnvSource): AppConfig {
  const env = parseOrThrow(identitySchema, source);
  return Object.freeze({
    name: env.NEXT_PUBLIC_APP_NAME,
    supportEmail: env.NEXT_PUBLIC_SUPPORT_EMAIL,
    // KIT CARD: remove this line.
    showKitCard: env.NEXT_PUBLIC_SHOW_KIT_CARD === KIT_CARD_FLAG.on,
    logo: { src: '/brand/logo.svg', srcOnDark: '/brand/logo-on-dark.svg', width: 132, height: 32 },
  });
}

export interface RuntimeEnv {
  /** Origin of the API. */
  readonly apiUrl: string;
}

/**
 * Parse the variables that tests and builds vary: the API origin.
 *
 * @param source - Values of the runtime `NEXT_PUBLIC_*` variables.
 * @throws Error naming every invalid variable.
 */
export function parseRuntimeEnv(source: EnvSource): RuntimeEnv {
  const env = parseOrThrow(runtimeSchema, source);
  return { apiUrl: env.NEXT_PUBLIC_API_URL };
}

/**
 * The runtime variables as the bundle sees them now. Each name is written out
 * because Next.js only inlines literal `process.env.NAME` reads.
 */
export function readRuntimeEnv(): RuntimeEnv {
  return parseRuntimeEnv({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });
}

/** The product identity, parsed once when the bundle loads. */
export const APP_CONFIG: AppConfig = parseAppConfig({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
  // KIT CARD: remove this line.
  NEXT_PUBLIC_SHOW_KIT_CARD: process.env.NEXT_PUBLIC_SHOW_KIT_CARD,
});

// Fail the build or the first render on a malformed runtime variable.
readRuntimeEnv();
