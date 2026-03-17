"use client";

import type { SVGProps } from "react";

export type AppIconName =
  | "undo"
  | "reset"
  | "plus"
  | "image"
  | "text"
  | "trash"
  | "chevron-left"
  | "chevron-right"
  | "templates"
  | "palette"
  | "background"
  | "style"
  | "font"
  | "size"
  | "edit"
  | "move-up"
  | "move-down"
  | "select"
  | "eye"
  | "eye-off"
  | "align-left"
  | "align-center"
  | "align-right"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "history-back"
  | "history-forward"
  | "close";

type AppIconProps = {
  name: AppIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">;

export function AppIcon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
  ...rest
}: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {renderIcon(name)}
    </svg>
  );
}

function renderIcon(name: AppIconName) {
  switch (name) {
    case "undo":
      return (
        <>
          <path d="M9 7H4v5" />
          <path d="M4 12c1.8-3 4.5-5 8.5-5 4.6 0 8.5 3.6 8.5 8" />
        </>
      );
    case "reset":
      return (
        <>
          <path d="M15 7h5v5" />
          <path d="M20 12c-1.8-3-4.5-5-8.5-5C6.9 7 3 10.6 3 15" />
        </>
      );
    case "plus":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case "image":
      return (
        <>
          <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
          <circle cx="9" cy="9" r="1.4" />
          <path d="M20.5 16l-4.8-4.8L8 19" />
        </>
      );
    case "text":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M12 6v12" />
        </>
      );
    case "trash":
      return (
        <>
          <path d="M4 7h16" />
          <path d="M9 7V5h6v2" />
          <path d="M7 7l1 12h8l1-12" />
        </>
      );
    case "chevron-left":
      return <path d="M15 6l-6 6 6 6" />;
    case "chevron-right":
      return <path d="M9 6l6 6-6 6" />;
    case "templates":
      return (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1.8" />
          <rect x="13" y="4" width="7" height="7" rx="1.8" />
          <rect x="4" y="13" width="7" height="7" rx="1.8" />
          <rect x="13" y="13" width="7" height="7" rx="1.8" />
        </>
      );
    case "palette":
      return (
        <>
          <path d="M12 4c4.6 0 8 3.2 8 7.5 0 2.7-2 4.8-4.6 4.8H13a1.5 1.5 0 0 0-1.5 1.5c0 1.7-1.4 3-3.1 3C5.1 20.8 3 18 3 14.6 3 8.8 7.2 4 12 4z" />
          <circle cx="8.2" cy="10.4" r="1" />
          <circle cx="11.3" cy="8.7" r="1" />
          <circle cx="14.8" cy="9" r="1" />
        </>
      );
    case "background":
      return (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M4 10h16" />
          <path d="M10 4v16" />
        </>
      );
    case "style":
      return (
        <>
          <path d="M4 17l6-10 4 6 2-3 4 7" />
        </>
      );
    case "font":
      return (
        <>
          <path d="M5 18l4-12 4 12" />
          <path d="M7 14h4" />
          <path d="M15 18V6h4" />
        </>
      );
    case "size":
      return (
        <>
          <path d="M4 18h8" />
          <path d="M4 18l2-2" />
          <path d="M4 18l2 2" />
          <path d="M20 6h-8" />
          <path d="M20 6l-2-2" />
          <path d="M20 6l-2 2" />
          <path d="M12 17V7" />
        </>
      );
    case "edit":
      return (
        <>
          <path d="M4 20h4l10-10-4-4L4 16v4z" />
          <path d="M12 6l4 4" />
        </>
      );
    case "move-up":
      return (
        <>
          <path d="M12 19V5" />
          <path d="M7 10l5-5 5 5" />
        </>
      );
    case "move-down":
      return (
        <>
          <path d="M12 5v14" />
          <path d="M7 14l5 5 5-5" />
        </>
      );
    case "select":
      return (
        <>
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M8 8h8v8H8z" />
        </>
      );
    case "eye":
      return (
        <>
          <path d="M2.5 12s3.4-5.5 9.5-5.5S21.5 12 21.5 12s-3.4 5.5-9.5 5.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      );
    case "eye-off":
      return (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.5 6.8a9.5 9.5 0 0 1 1.5-.3c6.1 0 9.5 5.5 9.5 5.5a17.6 17.6 0 0 1-3.4 3.8" />
          <path d="M6.3 8.3A18.1 18.1 0 0 0 2.5 12s3.4 5.5 9.5 5.5a9.5 9.5 0 0 0 3.1-.5" />
          <path d="M10.8 10.8a1.8 1.8 0 0 0 2.5 2.5" />
        </>
      );
    case "align-left":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M4 10h11" />
          <path d="M4 14h16" />
          <path d="M4 18h11" />
        </>
      );
    case "align-center":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M6.5 10h11" />
          <path d="M4 14h16" />
          <path d="M6.5 18h11" />
        </>
      );
    case "align-right":
      return (
        <>
          <path d="M4 6h16" />
          <path d="M9 10h11" />
          <path d="M4 14h16" />
          <path d="M9 18h11" />
        </>
      );
    case "bold":
      return (
        <>
          <path d="M7 5h6a3 3 0 0 1 0 6H7z" />
          <path d="M7 11h7a3.5 3.5 0 0 1 0 7H7z" />
        </>
      );
    case "italic":
      return (
        <>
          <path d="M13 5h7" />
          <path d="M4 19h7" />
          <path d="M14 5L10 19" />
        </>
      );
    case "underline":
      return (
        <>
          <path d="M7 5v6a5 5 0 0 0 10 0V5" />
          <path d="M5 20h14" />
        </>
      );
    case "strike":
      return (
        <>
          <path d="M8 7.8a3.2 3.2 0 0 1 3-2h1a3 3 0 1 1 0 6h-1a3 3 0 1 0 0 6h1a3.2 3.2 0 0 0 3-2" />
          <path d="M4 12h16" />
        </>
      );
    case "history-back":
      return (
        <>
          <path d="M9 7H4v5" />
          <path d="M4 12a8 8 0 1 0 2.3-5.7" />
        </>
      );
    case "history-forward":
      return (
        <>
          <path d="M15 7h5v5" />
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
        </>
      );
    case "close":
      return (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      );
    default:
      return null;
  }
}
