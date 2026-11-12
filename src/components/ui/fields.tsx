"use client";

import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return <input ref={ref} className={cn("input", className)} aria-invalid={invalid || undefined} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn("input", className)} aria-invalid={invalid || undefined} {...props} />;
});

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("input pr-8", className)} {...props} />;
}

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
}

export function RadioGroup({
  value,
  onValueChange,
  options,
  label,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: RadioOption[];
  label: string;
}) {
  return (
    <RadioPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={label}
      className="flex flex-col gap-2"
    >
      {options.map((option) => (
        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3">
          <RadioPrimitive.Item
            value={option.value}
            className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong bg-surface data-[state=checked]:border-primary"
          >
            <RadioPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
          </RadioPrimitive.Item>
          <span>
            <span className="font-medium">{option.label}</span>
            {option.hint ? <span className="ml-2 text-ink-2">{option.hint}</span> : null}
          </span>
        </label>
      ))}
    </RadioPrimitive.Root>
  );
}
