"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type {
  Category,
  ListingImage,
  Offer,
  UploadedImage,
} from "../types/marketplace";
import { api, errorText } from "../utils/api-client";
import { parsePriceMinor, parseStock, priceText } from "../utils/money";
import {
  changedFields,
  createBody,
  type OfferDraft,
} from "../utils/offer-changes";
import {
  ImagePicker,
  itemKey,
  Notice,
  SelectField,
  TextField,
  type ImageItem,
} from "./form-parts";

type VariationRow = {
  key: string;
  offerItemId?: string;
  label: string;
  price: string;
  stock: string;
  images: ImageItem[];
};

const MEASURE_FIELDS = [
  ["lengthCm", "Length (cm)"],
  ["widthCm", "Width (cm)"],
  ["heightCm", "Height (cm)"],
  ["weightGrams", "Weight (g)"],
] as const;
type MeasureKey = (typeof MEASURE_FIELDS)[number][0];

const imagesOf = (images: ListingImage[]): ImageItem[] =>
  images.map((image) => ({
    key: itemKey(),
    imageKey: image.imageKey,
    previewUrl: image.imageUrl,
  }));

/** Shared catalog categories; null while loading, a string on failure. */
function useCategories() {
  const [categories, setCategories] = useState<Category[] | string | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    api<Category[]>("GET", "/categories").then((result) => {
      if (live) setCategories(result.ok ? result.data : errorText(result));
    });
    return () => {
      live = false;
    };
  }, []);
  return categories;
}

export type ProductSaved = { offer: Offer; message: string };

/**
 * New product (`offer` absent) or edit. Validates, uploads new images, then
 * sends createOffer or an updateOffer with only the changed fields.
 */
export function ProductForm({
  sellerId,
  offer,
  submitLabel,
  onSaved,
  onCancel,
  secondaryAction,
}: {
  sellerId: string;
  offer?: Offer;
  submitLabel: string;
  onSaved: (saved: ProductSaved) => void;
  onCancel?: () => void;
  secondaryAction?: React.ReactNode;
}) {
  const categories = useCategories();
  const base = offer && !offer.hasVariations ? offer.items[0] : undefined;
  const [name, setName] = useState(offer?.name ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [category, setCategory] = useState<string>(offer?.categorySlug ?? "");
  const [images, setImages] = useState<ImageItem[]>(
    offer ? imagesOf(offer.images) : [],
  );
  const [price, setPrice] = useState(base ? priceText(base.priceMinor) : "");
  const [stock, setStock] = useState(base ? String(base.stock) : "");
  const [measures, setMeasures] = useState<Record<MeasureKey, string>>(
    () =>
      Object.fromEntries(
        MEASURE_FIELDS.map(([key]) => [
          key,
          offer?.[key] != null ? String(offer[key]) : "",
        ]),
      ) as Record<MeasureKey, string>,
  );
  const [variationsOn, setVariationsOn] = useState(
    offer?.hasVariations ?? false,
  );
  const [variations, setVariations] = useState<VariationRow[]>(
    offer?.items
      .filter(() => offer.hasVariations)
      .map((item) => ({
        key: itemKey(),
        offerItemId: item.offerItemId,
        label: item.label,
        price: priceText(item.priceMinor),
        stock: String(item.stock),
        images: item.inheritsImages ? [] : imagesOf(item.images),
      })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const updateRow = (key: string, patch: Partial<VariationRow>) =>
    setVariations((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  const addRow = () =>
    setVariations((rows) => [
      ...rows,
      { key: itemKey(), label: "", price: "", stock: "", images: [] },
    ]);

  function validate(): string | null {
    if (name.trim().length < 2)
      return "Error: Please enter a product name (at least 2 characters).";
    if (!category) return "Error: Please choose a category.";
    if (images.length === 0 && (!offer || offer.images.length > 0))
      return "Error: Please add at least one product image.";
    if (variationsOn) {
      if (variations.length === 0)
        return "Error: Add a variation or turn variations off.";
      for (const [index, row] of variations.entries()) {
        const where = `variation ${index + 1}`;
        if (!row.label.trim())
          return `Error: Please enter a label for ${where}.`;
        if (parsePriceMinor(row.price) === null)
          return `Error: Please enter a price like 24.90 for ${where}.`;
        if (parseStock(row.stock) === null)
          return `Error: Stock must be a whole number, 0 or more, for ${where}.`;
      }
    } else {
      if (parsePriceMinor(price) === null || parsePriceMinor(price) === 0)
        return "Error: Please enter a price like 24.90.";
      if (parseStock(stock) === null)
        return "Error: Stock must be a whole number, 0 or more.";
    }
    for (const [key, label] of MEASURE_FIELDS) {
      const text = measures[key].trim().replace(",", ".");
      if (text && !(Number(text) > 0))
        return `Error: ${label} must be a positive number.`;
    }
    return null;
  }

  /** Uploads images that have no ID yet and stores the IDs, so a retry does not upload twice. */
  async function upload(items: ImageItem[]): Promise<ImageItem[] | string> {
    const done: ImageItem[] = [];
    for (const item of items) {
      if (item.imageKey || !item.file) {
        done.push(item);
        continue;
      }
      const result = await api<UploadedImage>(
        "POST",
        `/sellers/${sellerId}/images`,
        item.file,
      );
      if (!result.ok) return errorText(result);
      done.push({ ...item, imageKey: result.data.imageKey });
    }
    return done;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    const invalid = validate();
    if (invalid) return setError(invalid);
    setError(null);
    setBusy(true);
    try {
      setStatus("Uploading images …");
      const mainImages = await upload(images);
      if (typeof mainImages === "string") return setError(mainImages);
      setImages(mainImages);
      const rows: VariationRow[] = [];
      if (variationsOn) {
        for (const row of variations) {
          const rowImages = await upload(row.images);
          if (typeof rowImages === "string") return setError(rowImages);
          rows.push({ ...row, images: rowImages });
        }
        setVariations(rows);
      }
      const measure = (key: MeasureKey) => {
        const text = measures[key].trim().replace(",", ".");
        return text ? Number(text) : null;
      };
      const draft: OfferDraft = {
        name: name.trim(),
        description: description.trim(),
        categorySlug: category,
        imageKeys: mainImages.map((item) => item.imageKey!),
        priceMinor: variationsOn ? null : parsePriceMinor(price),
        stock: variationsOn ? null : parseStock(stock),
        variations: rows.map((row) => ({
          offerItemId: row.offerItemId,
          label: row.label.trim(),
          priceMinor: parsePriceMinor(row.price)!,
          stock: parseStock(row.stock)!,
          imageKeys: row.images.map((item) => item.imageKey!),
        })),
        lengthCm: measure("lengthCm"),
        widthCm: measure("widthCm"),
        heightCm: measure("heightCm"),
        weightGrams: measure("weightGrams"),
      };
      setStatus("Saving …");
      if (!offer) {
        const result = await api<Offer>(
          "POST",
          `/sellers/${sellerId}/offers`,
          createBody(draft),
        );
        if (!result.ok) return setError(errorText(result));
        setStatus(null);
        return onSaved({
          offer: result.data,
          message: "Submitted for review.",
        });
      }
      const changes = changedFields(offer, draft);
      if (Object.keys(changes).length === 0)
        return setStatus("Nothing changed.");
      const result = await api<Offer>(
        "PATCH",
        `/offers/${offer.offerId}`,
        changes,
      );
      if (!result.ok) return setError(errorText(result));
      setStatus(null);
      const backInReview =
        offer.status === "active" && result.data.status === "pending";
      onSaved({
        offer: result.data,
        message: backInReview
          ? "Saved. The product is in review again because its details changed."
          : "Saved.",
      });
    } finally {
      setBusy(false);
      setStatus((current) =>
        current === "Uploading images …" || current === "Saving …"
          ? null
          : current,
      );
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic information</CardTitle>
            {offer && (
              <p className="text-xs text-muted-foreground">
                Product ID {offer.productId}
              </p>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            <TextField
              label="Product name"
              value={name}
              onChange={setName}
              maxLength={80}
            />
            <TextField
              label="Description"
              hint="Up to 1000 characters."
              multiline
              value={description}
              onChange={setDescription}
            />
            <SelectField
              label="Category"
              hint={
                typeof categories === "string"
                  ? categories
                  : categories?.length === 0
                    ? "The shared catalog has no categories yet. Ask the catalog owners (Admin & Identity) to add them."
                    : "Categories come from the shared shop catalog."
              }
              value={category}
              onChange={setCategory}
              disabled={!Array.isArray(categories)}
              options={[
                {
                  value: "",
                  label:
                    categories === null
                      ? "Loading categories …"
                      : "Choose a category",
                },
                ...(Array.isArray(categories) ? categories : []).map((c) => ({
                  value: c.slug,
                  label: c.name,
                })),
                // Keep a current category that is no longer listed selectable.
                ...(offer &&
                Array.isArray(categories) &&
                !categories.some((c) => c.slug === offer.categorySlug)
                  ? [{ value: offer.categorySlug, label: offer.categorySlug }]
                  : []),
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ImagePicker
              label="Product images"
              hint="1 to 10 JPG, PNG or WEBP images, up to 5 MB each. The first image is the main image."
              images={images}
              onChange={setImages}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pricing and inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={variationsOn}
                onChange={(event) => {
                  setVariationsOn(event.target.checked);
                  if (event.target.checked && variations.length === 0) addRow();
                }}
              />
              This product has variations (for example sizes or colours)
            </label>
            {!variationsOn ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Price incl. VAT (€)"
                  hint="For example 24.90."
                  inputMode="decimal"
                  value={price}
                  onChange={setPrice}
                />
                <TextField
                  label="Stock"
                  hint="How many you can sell."
                  inputMode="numeric"
                  value={stock}
                  onChange={setStock}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The product price is the cheapest variation and the stock is
                  the sum of all variations.
                </p>
                {variations.map((row, index) => (
                  <fieldset
                    key={row.key}
                    className="space-y-3 rounded-md border p-3"
                  >
                    <legend className="px-1 text-sm font-medium">
                      Variation {index + 1}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <TextField
                        label="Label"
                        hint="For example Blue / M."
                        value={row.label}
                        onChange={(label) => updateRow(row.key, { label })}
                        maxLength={80}
                      />
                      <TextField
                        label="Price incl. VAT (€)"
                        inputMode="decimal"
                        value={row.price}
                        onChange={(value) =>
                          updateRow(row.key, { price: value })
                        }
                      />
                      <TextField
                        label="Stock"
                        inputMode="numeric"
                        value={row.stock}
                        onChange={(value) =>
                          updateRow(row.key, { stock: value })
                        }
                      />
                    </div>
                    <ImagePicker
                      label={`Images of variation ${index + 1}`}
                      hint="Optional. Without images the variation shows the product images."
                      images={row.images}
                      onChange={(rowImages) =>
                        updateRow(row.key, { images: rowImages })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setVariations((rows) =>
                          rows.filter((r) => r.key !== row.key),
                        )
                      }
                    >
                      Remove variation {index + 1}
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  disabled={variations.length >= 100}
                >
                  Add variation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Product details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            {MEASURE_FIELDS.map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                hint="Optional."
                inputMode="decimal"
                value={measures[key]}
                onChange={(value) =>
                  setMeasures((current) => ({ ...current, [key]: value }))
                }
              />
            ))}
          </CardContent>
        </Card>
      </fieldset>
      <Notice error={error} status={status} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {submitLabel}
        </Button>
        {secondaryAction}
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
