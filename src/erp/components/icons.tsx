import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "orders"
  | "invoice"
  | "truck"
  | "chart"
  | "refund"
  | "settings"
  | "search"
  | "calendar"
  | "menu"
  | "close"
  | "chevron"
  | "info"
  | "dots"
  | "plus"
  | "edit"
  | "user";

const PATHS: Record<IconName, string> = {
  home: "M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10",
  orders: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  invoice: "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4",
  truck: "M2 6h12v10H2zM14 10h4l3 3v3h-7M6 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  chart: "M4 20V10M10 20V4M16 20v-8M22 20H2",
  refund: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "M6 9l6 6 6-6",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 11v6M12 7.5v.01",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
};

/** Ícones simples de traço único; decorativos (aria-hidden) porque sempre acompanham texto. */
export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
