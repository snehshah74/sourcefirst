"use client";
import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

// Same origin as the app, so no baseURL needed.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
export const { signOut } = authClient;
