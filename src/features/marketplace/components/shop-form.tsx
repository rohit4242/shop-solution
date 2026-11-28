"use client";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import type { RegisterSellerInput } from "../schemas/marketplace.schema";
import type { SellerAccount } from "../types/marketplace";
import { Notice, TextField } from "./form-parts";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ShopValues = RegisterSellerInput;

/** Shop details for setup (step 1) and for editing. Validates before anything is sent. */
export function ShopForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SellerAccount;
  submitLabel: string;
  /** Resolves to an error text, or null on success. */
  onSubmit: (values: ShopValues) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState({
    displayName: initial?.displayName ?? "",
    legalName: initial?.legalName ?? "",
    contactEmail: initial?.contactEmail ?? "",
    street: initial?.address.street ?? "",
    postalCode: initial?.address.postalCode ?? "",
    city: initial?.address.city ?? "",
    country: initial?.address.country ?? "DE",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const v = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim()]),
    ) as typeof values;
    if (Object.values(v).some((value) => value === ""))
      return setError("Error: Please fill in all fields.");
    if (v.displayName.length < 2 || v.legalName.length < 2)
      return setError(
        "Error: Shop name and legal name need at least 2 characters.",
      );
    if (!EMAIL.test(v.contactEmail))
      return setError("Error: Please enter a valid e-mail address.");
    if (!/^[A-Z]{2}$/.test(v.country))
      return setError("Error: Country must be a two-letter code like DE.");
    setError(null);
    setBusy(true);
    const failure = await onSubmit({
      displayName: v.displayName,
      legalName: v.legalName,
      contactEmail: v.contactEmail,
      address: {
        street: v.street,
        postalCode: v.postalCode,
        city: v.city,
        country: v.country,
      },
    });
    setBusy(false);
    setError(failure);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Shop name"
          hint="Customers see this name."
          value={values.displayName}
          onChange={set("displayName")}
          maxLength={60}
        />
        <TextField
          label="Legal name"
          hint="The registered name of your business."
          value={values.legalName}
          onChange={set("legalName")}
          maxLength={100}
        />
        <TextField
          label="Contact e-mail"
          hint="We write to you here about your shop."
          type="email"
          autoComplete="email"
          value={values.contactEmail}
          onChange={set("contactEmail")}
          maxLength={120}
        />
        <TextField
          label="Street"
          hint="Street and house number."
          autoComplete="address-line1"
          value={values.street}
          onChange={set("street")}
          maxLength={100}
        />
        <TextField
          label="Postal code"
          autoComplete="postal-code"
          value={values.postalCode}
          onChange={set("postalCode")}
          maxLength={12}
        />
        <TextField
          label="City"
          autoComplete="address-level2"
          value={values.city}
          onChange={set("city")}
          maxLength={60}
        />
        <TextField
          label="Country"
          hint="Two capital letters, for example DE."
          autoComplete="country"
          value={values.country}
          onChange={set("country")}
          maxLength={2}
        />
      </fieldset>
      <Notice error={error} status={busy ? "Saving …" : null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
