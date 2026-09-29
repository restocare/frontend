import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const GridIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l3-3 3 3 5-6" />
  </svg>
);

export const UsersIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const BagIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

export const StoreIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 9 4.5 4h15L21 9" />
    <path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0Z" />
    <path d="M4 11v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" />
    <path d="M9 20v-5h6v5" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const PencilIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

export const SettingsIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 12h18M3 6h18M3 18h18" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const MailIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EyeOffIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88M2 2l20 20" />
  </svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
);

export const TrendUp = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M22 7 13.5 15.5 8.5 10.5 2 17" />
    <path d="M16 7h6v6" />
  </svg>
);

export const TrendDown = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M22 17 13.5 8.5 8.5 13.5 2 7" />
    <path d="M16 17h6v-6" />
  </svg>
);

export const SpinnerIcon = (p: IconProps) => (
  <svg {...base} {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export const ImageIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-4.5-4.5L3 21" />
  </svg>
);

export const MapPinIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const CartIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

export const UserCircleIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.5 19a6 6 0 0 1 11 0" />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...base} {...p} fill="currentColor" stroke="none">
    <path d="M12 2l2.95 6.18 6.8.78-5.04 4.6 1.36 6.72L12 17.6 5.93 20.9l1.36-6.72L2.25 9.6l6.8-.78L12 2Z" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const PaletteIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3a9 9 0 0 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.39-.61-.39-1 0-.83.67-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Z" />
    <circle cx="7.5" cy="10.5" r="1" />
    <circle cx="12" cy="7.5" r="1" />
    <circle cx="16.5" cy="10.5" r="1" />
  </svg>
);

export const MonitorIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const SmartphoneIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="6" y="2" width="12" height="20" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
);

export const GoogleIcon = (p: IconProps) => (
  <svg width={20} height={20} viewBox="0 0 24 24" {...p}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
    />
  </svg>
);

export const PolygonIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 4.5 19 7l-1.5 10.5L4 18l3-13.5Z" />
    <circle cx="7" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="7" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="17.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const WarehouseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 21V9l9-5 9 5v12" />
    <path d="M7 21v-8h10v8" />
    <path d="M7 17h10" />
  </svg>
);

export const RouteIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" />
  </svg>
);

export const TagIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L3 13V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z" />
    <circle cx="7.5" cy="7.5" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const BriefcaseIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const ShieldIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const BoltIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" />
  </svg>
);

export const BadgeCheckIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M12 2.5l2.1 1.8 2.7-.4 1 2.6 2.6 1-.4 2.7 1.8 2.1-1.8 2.1.4 2.7-2.6 1-1 2.6-2.7-.4-2.1 1.8-2.1-1.8-2.7.4-1-2.6-2.6-1 .4-2.7L2.5 12l1.8-2.1-.4-2.7 2.6-1 1-2.6 2.7.4L12 2.5z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const ClipboardIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1H9V4z" />
    <path d="M9 11h6M9 15h4" />
  </svg>
);

export const WrenchIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 0 0 5.6-6L14.5 12l-2.5-2.5 2.7-3.2z" />
  </svg>
);

export const FileTextIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const BuildingIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
    <path d="M16 9h2a2 2 0 0 1 2 2v10" />
    <path d="M2 21h20" />
    <path d="M8 7h2M8 11h2M8 15h2M13 7h0M13 11h0M13 15h0" />
  </svg>
);

export const PhoneIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />
  </svg>
);

export const GraduationCapIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M22 9L12 4 2 9l10 5 10-5z" />
    <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    <path d="M22 9v5" />
  </svg>
);

/** Aura — concentric rings around a core, the life-tracker brand mark. */
export const AuraIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 5.5a6.5 6.5 0 0 1 0 13" />
    <path d="M12 5.5a6.5 6.5 0 0 0 0 13" opacity="0.45" />
    <path d="M12 2a10 10 0 0 1 0 20" opacity="0.7" />
  </svg>
);
