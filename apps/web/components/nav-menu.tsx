// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Banknote,
  Boxes,
  Braces,
  Building2,
  ChevronDown,
  Cpu,
  Gauge,
  GitBranch,
  Layers,
  LineChart,
  ListChecks,
  Menu,
  Radar,
  Scale,
  ShieldAlert,
  Wallet,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";

interface SubItem {
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}
interface Category {
  id: string;
  label: string;
  items: SubItem[];
}

// The site taxonomy. Product is the live console (sections on the home route);
// Venues, Developers and Reports are their own focused routes. Nothing is scattered:
// each submenu classifies exactly one category. Each item lands on its own space.
const CATEGORIES: Category[] = [
  {
    id: "product",
    label: "Product",
    items: [
      { label: "Best execution", desc: "Rank every venue by all-in landed cost", href: "/#bestexec", icon: Gauge },
      { label: "Consolidated tape", desc: "One premium row per tracked underlying", href: "/#tape", icon: LineChart },
      { label: "Premium radar", desc: "The same stock priced across issuers", href: "/#radar", icon: Radar },
      { label: "Arb signal", desc: "Cross-issuer dispersion, net of fees", href: "/#arb", icon: ArrowLeftRight },
    ],
  },
  {
    id: "venues",
    label: "Venues",
    items: [
      { label: "Chainlink reference", desc: "The true underlying price we measure against", href: "/venues#chainlink", icon: Waypoints },
      { label: "PancakeSwap", desc: "On-chain pools, permissionless and executable", href: "/venues#pancakeswap", icon: Layers },
      { label: "Binance", desc: "The central order book, deep but gated", href: "/venues#binance", icon: Building2 },
      { label: "Ondo", desc: "Issuer mint and redeem at NAV", href: "/venues#ondo", icon: Banknote },
    ],
  },
  {
    id: "developers",
    label: "Developers",
    items: [
      { label: "SDK", desc: "The @opentape/sdk engine, typed and pure", href: "/developers#sdk", icon: Boxes },
      { label: "API endpoints", desc: "Best exec, arb, tape and underlyings over HTTP", href: "/developers#api", icon: Braces },
      { label: "Wallet skill", desc: "One-click execute from an injected wallet", href: "/developers#wallet-skill", icon: Wallet },
      { label: "Executor contract", desc: "The on-chain best-route swap on BNB Chain", href: "/developers#executor", icon: Cpu },
      { label: "GitHub", desc: "Read the source and the tests", href: "/developers#github", icon: GitBranch },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    items: [
      { label: "Validation metrics", desc: "How close our best price tracks the truth", href: "/reports#validation", icon: Activity },
      { label: "Methodology", desc: "How best price and premium are computed", href: "/reports#methodology", icon: Scale },
      { label: "Honesty and limits", desc: "What is live, what is a signal, what is demo", href: "/reports#limits", icon: ShieldAlert },
      { label: "Tests and verification", desc: "The suite that proves the engine", href: "/reports#tests", icon: ListChecks },
    ],
  },
];

// PLACEHOLDER_BODY

export function NavMenu() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const focusOpenAt = useRef(0);
  const pathname = usePathname();

  // Close everything when the route changes.
  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close on outside pointer down.
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenId(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const closeAll = useCallback(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, []);

  const moveFocus = useCallback((menu: HTMLElement | null, dir: 1 | -1) => {
    if (!menu) return;
    const items = Array.from(menu.querySelectorAll<HTMLAnchorElement>("[role='menuitem']"));
    if (!items.length) return;
    const idx = items.findIndex((el) => el === document.activeElement);
    const next = idx === -1 ? (dir === 1 ? 0 : items.length - 1) : (idx + dir + items.length) % items.length;
    items[next]?.focus();
  }, []);

  return (
    <nav className="cat-nav" aria-label="Primary" ref={navRef}>
      <button
        type="button"
        className="btn btn-icon nav-hamburger"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        aria-controls="cat-list"
        onClick={() => {
          setMobileOpen((v) => !v);
          setOpenId(null);
        }}
      >
        {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>

      <ul id="cat-list" className={`cat-list${mobileOpen ? " open" : ""}`}>
        {CATEGORIES.map((cat) => {
          const open = openId === cat.id;
          return (
            <li
              key={cat.id}
              className={`cat${open ? " open" : ""}`}
              onMouseEnter={() => setOpenId(cat.id)}
              onMouseLeave={() => setOpenId((cur) => (cur === cat.id ? null : cur))}
              onFocus={() => {
                if (openId !== cat.id) {
                  focusOpenAt.current = Date.now();
                  setOpenId(cat.id);
                }
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOpenId((cur) => (cur === cat.id ? null : cur));
                }
              }}
            >
              <button
                type="button"
                className="cat-trigger"
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => {
                  const openedByFocus = Date.now() - focusOpenAt.current < 350;
                  setOpenId((cur) => (cur === cat.id && !openedByFocus ? null : cat.id));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpenId(null);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpenId(cat.id);
                    const menu = e.currentTarget.nextElementSibling as HTMLElement | null;
                    requestAnimationFrame(() => moveFocus(menu, 1));
                  }
                }}
              >
                {cat.label}
                <ChevronDown className="cat-caret" size={15} aria-hidden="true" />
              </button>

              <div
                className="submenu"
                role="menu"
                aria-label={cat.label}
                hidden={!open}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setOpenId(null);
                    (e.currentTarget.previousElementSibling as HTMLElement | null)?.focus();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    moveFocus(e.currentTarget, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    moveFocus(e.currentTarget, -1);
                  }
                }}
              >
                {cat.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Link key={it.href} href={it.href} role="menuitem" className="submenu-item" onClick={closeAll}>
                      <span className="submenu-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <span className="submenu-text">
                        <span className="submenu-label">{it.label}</span>
                        <span className="submenu-desc">{it.desc}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

