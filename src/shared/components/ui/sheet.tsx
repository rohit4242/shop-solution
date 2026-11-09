"use client";
import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/cn";
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
      <Dialog.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-80 max-w-[90vw] overflow-y-auto border-r bg-background p-6 shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className="absolute top-4 right-4 rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
