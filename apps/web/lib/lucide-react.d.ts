// SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0

// lucide-react 1.47.0 in this workspace ships icon runtime and .d.ts files but no
// "types"/"exports" entry, so bundler resolution does not pick the declarations up
// automatically. This ambient module types exactly the icons this app imports.
// We do not add dependencies, so a local declaration is the correct fix here.
declare module "lucide-react" {
  import type { FC, SVGProps } from "react";

  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }
  export type LucideIcon = FC<LucideProps>;

  export const Zap: LucideIcon;
  export const Wallet: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowLeftRight: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Radar: LucideIcon;
  export const Info: LucideIcon;
  export const Gauge: LucideIcon;
  export const Layers: LucideIcon;
  export const CircleCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Scale: LucideIcon;
  export const Lock: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Search: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const Check: LucideIcon;
  export const CircleDollarSign: LucideIcon;
  export const Sun: LucideIcon;
  export const Moon: LucideIcon;
  export const Menu: LucideIcon;
  export const X: LucideIcon;
  export const GitBranch: LucideIcon;
  export const Code2: LucideIcon;
  export const Braces: LucideIcon;
  export const Terminal: LucideIcon;
  export const FileText: LucideIcon;
  export const FileCode2: LucideIcon;
  export const FlaskConical: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const Boxes: LucideIcon;
  export const LineChart: LucideIcon;
  export const Cpu: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Puzzle: LucideIcon;
  export const ListChecks: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const ArrowLeftRight: LucideIcon;
  export const Database: LucideIcon;
  export const Network: LucideIcon;
  export const Building2: LucideIcon;
  export const Banknote: LucideIcon;
  export const Waypoints: LucideIcon;
  export const Link: LucideIcon;
  export const Activity: LucideIcon;
  export const CircleCheckBig: LucideIcon;
}
