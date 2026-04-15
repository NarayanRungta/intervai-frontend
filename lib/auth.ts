import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/src";
import * as schema from "@/src/db/schema";

export const auth = betterAuth({
    socialProviders: { 
        github: { 
            clientId: process.env.GITHUB_CLIENT_ID!, 
            clientSecret: process.env.GITHUB_CLIENT_SECRET!, 
        } 
    }, 
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
});