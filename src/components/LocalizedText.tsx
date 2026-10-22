import React from "react";
import { isRtlLocale, SupportedLocale } from "../constants/i18n";

export interface LocalizedTextProps {
  children: React.ReactNode;
  locale?: SupportedLocale | string;
  className?: string;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3";
  role?: string;
  id?: string;
  lang?: string;
}

export const LocalizedText = React.forwardRef<HTMLElement, LocalizedTextProps>(
  (
    {
      children,
      locale,
      className = "",
      as = "span",
      role,
      id,
      lang,
    },
    ref,
  ) => {
    const Tag = as as React.ElementType;
    const dir = locale ? (isRtlLocale(locale) ? "rtl" : "ltr") : "auto";

    return (
      <Tag
        ref={ref}
        className={["localized-text", className].filter(Boolean).join(" ")}
        dir={dir}
        lang={lang ?? (locale as string | undefined)}
        role={role}
        id={id}
      >
        {children}
      </Tag>
    );
  },
);

LocalizedText.displayName = "LocalizedText";
