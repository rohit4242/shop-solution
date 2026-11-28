"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

type FieldErrors = Record<string, string[]>;

const ids = (value: string) =>
  value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
// <input type="datetime-local"> has no time zone; the browser's zone is used.
const isoOrUndefined = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

/** Step j: create a promotion with a period and conditions (products and/or categories). */
export function PromotionForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body = {
      name: text("name"),
      description: text("description"),
      type: text("type"),
      value: text("value") === "" ? undefined : Number(text("value")),
      productIds: ids(text("productIds")),
      categoryIds: ids(text("categoryIds")),
      validFrom: isoOrUndefined(text("validFrom")),
      validTo: isoOrUndefined(text("validTo")),
    };
    setPending(true);
    setError(null);
    setFieldErrors({});
    setStatus(null);
    try {
      const response = await fetch("/api/v1/marketing/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errors = payload?.error?.fieldErrors ?? {};
        setFieldErrors(errors);
        setError(
          errors._?.[0] ??
            (Object.keys(errors).length > 0
              ? "Not saved yet. Fix the marked fields and try again."
              : undefined) ??
            payload?.error?.message ??
            `The promotion was not saved (HTTP ${response.status}). Try again.`,
        );
        return;
      }
      (event.target as HTMLFormElement).reset();
      setStatus(`Promotion "${payload.data.name}" created.`);
      router.refresh();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`${name}-error`} className="text-sm text-destructive">
        {fieldErrors[name].join(" ")}
      </p>
    ) : null;
  const described = (name: string) =>
    fieldErrors[name]
      ? { "aria-invalid": true, "aria-describedby": `${name}-error` }
      : {};

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-2"
      aria-label="New promotion"
      noValidate
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. M1 10 %"
          {...described("name")}
        />
        {fieldError("name")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="e.g. 10 % off M1 in December"
          {...described("description")}
        />
        {fieldError("description")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="type">Type</Label>
        <select
          id="type"
          name="type"
          defaultValue="percent"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:text-sm"
        >
          <option value="percent">Percent off</option>
          <option value="fixed">Fixed amount off (EUR)</option>
        </select>
        {fieldError("type")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="value">Value</Label>
        <Input
          id="value"
          name="value"
          type="number"
          step="0.01"
          min="0"
          placeholder="e.g. 10"
          {...described("value")}
        />
        {fieldError("value")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="productIds">Product IDs (comma-separated)</Label>
        <Input
          id="productIds"
          name="productIds"
          placeholder="e.g. M1"
          {...described("productIds")}
        />
        {fieldError("productIds")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="categoryIds">
          Category IDs (comma-separated, optional)
        </Label>
        <Input
          id="categoryIds"
          name="categoryIds"
          {...described("categoryIds")}
        />
        {fieldError("categoryIds")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="validFrom">Valid from (empty = now)</Label>
        <Input
          id="validFrom"
          name="validFrom"
          type="datetime-local"
          {...described("validFrom")}
        />
        {fieldError("validFrom")}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="validTo">Valid to (optional)</Label>
        <Input
          id="validTo"
          name="validTo"
          type="datetime-local"
          {...described("validTo")}
        />
        {fieldError("validTo")}
      </div>
      <p className="text-sm text-muted-foreground sm:col-span-2">
        Leave both ID fields empty to discount the whole cart. One discount per
        cart: the biggest wins.
      </p>
      <div className="flex items-center gap-4 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create promotion"}
        </Button>
        {status && (
          <p role="status" className="text-sm">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
