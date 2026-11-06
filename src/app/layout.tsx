import type { Metadata } from "next";
import "@fontsource/rozha-one";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Slip: USDC payment links on Arc",
  description: "Create a link, send it to a client, and get paid in USDC or EURC on Arc.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          Independent open-source project. Not affiliated with Arc or Circle.{" "}
          <a href="https://github.com/CryptoRapidox/arc-payment-link">Source code</a>
        </footer>
      </body>
    </html>
  );
}
