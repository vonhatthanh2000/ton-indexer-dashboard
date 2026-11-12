"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** The one-time key modal closes only through its buttons. */
  dismissible?: boolean;
}

export function Dialog({ open, onOpenChange, title, description, children, footer, dismissible = true }: DialogProps) {
  const block = (event: Event) => event.preventDefault();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fade-in" />
        <DialogPrimitive.Content
          className="dialog-panel fade-in"
          onPointerDownOutside={dismissible ? undefined : block}
          onInteractOutside={dismissible ? undefined : block}
          onEscapeKeyDown={dismissible ? undefined : block}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-card-title font-semibold">{title}</DialogPrimitive.Title>
            {dismissible ? (
              <DialogPrimitive.Close className="btn btn-secondary btn-icon -mt-2 -mr-2 border-0" aria-label="Close">
                <X size={18} strokeWidth={1.5} />
              </DialogPrimitive.Close>
            ) : null}
          </div>
          {description ? (
            <DialogPrimitive.Description className="mt-2 text-ink-2">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          )}
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay fade-in" />
        <DialogPrimitive.Content className="drawer-panel slide-in">
          <div className="flex items-start justify-between gap-4">
            <DialogPrimitive.Title className="text-card-title font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="btn btn-secondary btn-icon -mt-2 -mr-2 border-0" aria-label="Close">
              <X size={18} strokeWidth={1.5} />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className={description ? "mt-2 text-ink-2" : "sr-only"}>
            {description ?? title}
          </DialogPrimitive.Description>
          <div className="mt-6">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
