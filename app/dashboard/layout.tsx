import type { ReactNode } from "react";

import { requireAuthenticatedUser } from "@/lib/require-auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAuthenticatedUser();
  return children;
}
