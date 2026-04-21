"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";

type AppSelectOption = {
  value: string;
  label: string;
  style?: CSSProperties;
  className?: string;
};

type AppSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
};

export function AppSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  ariaLabel,
  triggerClassName,
  contentClassName,
  itemClassName
}: AppSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger
        className={["app-select-trigger", triggerClassName].filter(Boolean).join(" ")}
        aria-label={ariaLabel}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDown size={16} aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={["app-select-content", contentClassName].filter(Boolean).join(" ")}
          sideOffset={8}
          position="popper"
        >
          <Select.Viewport className="app-select-viewport">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={["app-select-item", itemClassName, option.className].filter(Boolean).join(" ")}
                style={option.style}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="app-select-item-indicator">
                  <Check size={14} aria-hidden="true" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
