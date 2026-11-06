import Link from "next/link";
import { mainnetEnabled } from "@/lib/networks";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        Slip
      </Link>
      <nav aria-label="Main">
        <Link href="/">New link</Link>
        <Link href="/history/">History</Link>
      </nav>
      {!mainnetEnabled ? (
        <p className="test-notice">Test network only. These tokens have no real value.</p>
      ) : null}
    </header>
  );
}
