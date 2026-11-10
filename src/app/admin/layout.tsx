import type { ReactNode } from "react";
import CommissionerShell from "@/components/commissioner/commissioner-shell";

/** The Commissioner area: the wheel at /admin and one page per spoke, all sharing the bar, the Handbook and the bottom dial. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <CommissionerShell>{children}</CommissionerShell>;
}
