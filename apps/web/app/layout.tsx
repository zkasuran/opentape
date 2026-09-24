// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { WalletProvider } from "../components/wallet";
import { ThemeProvider } from "../components/theme";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Set the theme before first paint so there is no flash of the wrong palette. Runs
// inline in <head> ahead of the stylesheet: an explicit ?theme= wins and is saved,
// else the saved choice, else the OS preference. It stamps data-theme on <html>
// which every color token keys off.
const NO_FOUC = `(function(){try{var p=new URLSearchParams(location.search).get('theme');if(p!=='light'&&p!=='dark')p=null;var t=p||localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');if(p)localStorage.setItem('theme',p);document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
      </head>
      <body>
        <ThemeProvider>
          <WalletProvider>{children}</WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
