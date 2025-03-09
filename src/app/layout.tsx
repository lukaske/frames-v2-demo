import type { Metadata } from "next";

import "~/app/globals.css";
import { Providers } from "~/app/providers";

export const metadata: Metadata = {
  title: "Flare Fact Checker",
  description: "Verifiable AI fact checker for Farcaster powered by the Flare Network.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (
    <html lang="en">
      <body>
        <Providers session={null}>{children}</Providers>
      </body>
    </html>
  );
}
