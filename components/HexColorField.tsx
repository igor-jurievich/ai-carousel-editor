"use client";

import { useEffect, useMemo, useState } from "react";

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_COLOR_FULL_RE = /^#[0-9a-f]{6}$/i;

function normalizeColorForInput(value: string | undefined, fallback: string) {
  const normalized = (value ?? "").trim();
  if (!HEX_COLOR_RE.test(normalized)) {
    return fallback;
  }

  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  return normalized;
}

function normalizeHexDraft(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "#";
  }
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return withHash.slice(0, 7).toUpperCase();
}

type HexColorFieldProps = {
  value: string;
  onValidChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function HexColorField({
  value,
  onValidChange,
  disabled = false,
  className = "field"
}: HexColorFieldProps) {
  const normalized = useMemo(
    () => normalizeColorForInput(value, "#000000").toUpperCase(),
    [value]
  );
  const [draft, setDraft] = useState(normalized);
  const isValid = HEX_COLOR_FULL_RE.test(draft);

  useEffect(() => {
    setDraft(normalized);
  }, [normalized]);

  return (
    <input
      type="text"
      inputMode="text"
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      maxLength={7}
      className={`${className} ${isValid ? "" : "field-invalid"}`.trim()}
      value={draft}
      onChange={(event) => {
        const nextDraft = normalizeHexDraft(event.target.value);
        setDraft(nextDraft);
        if (HEX_COLOR_FULL_RE.test(nextDraft)) {
          onValidChange(nextDraft);
        }
      }}
      disabled={disabled}
    />
  );
}
