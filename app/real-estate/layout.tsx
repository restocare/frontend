import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { Toaster } from "sonner";
import { NavigationProgress } from "@/components/navigation-progress";
import RealEstateShell from "./shell";

// Reference app body font — applied to this section only so the rest of the
// panel keeps Geist.
const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Real Estate — AI Sales Agent",
  robots: { index: false, follow: false },
};

export default function RealEstateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${urbanist.variable} font-[family-name:var(--font-urbanist)]`}
    >
      <NavigationProgress />
      <RealEstateShell>{children}</RealEstateShell>
      <Toaster richColors position="top-right" />
    </div>
  );
}
