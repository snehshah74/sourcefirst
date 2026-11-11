import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { getDb, schema } from "@/db";
import { esc, sendEmail } from "./email";

const baseURL = process.env.BETTER_AUTH_URL ?? process.env.SITE_URL ?? "http://localhost:3000";

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : undefined;

export const googleEnabled = !!google;

// Better Auth needs a db handle at construction time; getDb() is async (it runs migrations),
// so the auth instance is built lazily on first use and cached.
const g = globalThis as unknown as { __sfauth?: Promise<ReturnType<typeof build>> };

function build(db: Awaited<ReturnType<typeof getDb>>) {
  return betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [baseURL, "http://localhost:3000", "http://localhost:3100"],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      // A password reset signs the account out everywhere (e.g. if it was reset because it leaked).
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your SourceFirst password",
          text: `Reset your password: ${url}\n\nIf you didn't ask for this, ignore this email.`,
          html: `<p>Reset your password:</p><p><a href="${esc(url)}">${esc(url)}</a></p><p>If you didn't ask for this, ignore this email.</p>`,
        });
      },
    },
    socialProviders: google,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    plugins: [nextCookies()],
  });
}

export function getAuth() {
  if (!g.__sfauth) g.__sfauth = getDb().then(build);
  return g.__sfauth;
}

/** Current user from the request cookies, or null. Use in server components and route handlers. */
export async function currentUser() {
  const auth = await getAuth();
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user ?? null;
}
