// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
import { SiteHeader } from "../components/site-header";
import { Hero } from "../components/hero";
import { Console } from "../components/console";
import { HowItWorks } from "../components/how-it-works";
import { SiteFooter } from "../components/site-footer";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Console />
        <HowItWorks />
      </main>
      <SiteFooter />
    </>
  );
}
