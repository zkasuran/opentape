// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "../components/wallet";

export const metadata: Metadata = {
  title: "OpenTape · best execution for tokenized stocks on BNB",
  description:
    "Trade any tokenized stock at the true best price across every issuer, one click on BNB Chain. A neutral consolidated tape, cross-issuer premium radar and best-execution advisor.",
  applicationName: "OpenTape",
  keywords: [
    "tokenized stocks",
    "BNB Chain",
    "best execution",
    "xStocks",
    "Ondo",
    "bStocks",
    "consolidated tape",
    "NBBO",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
