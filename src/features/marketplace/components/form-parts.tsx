"use client";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

/** A labelled input with an optional hint linked through aria-describedby. */
export function TextField({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  ...input
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hintId}
          disabled={input.disabled}
          rows={4}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={hintId}
          {...input}
        />
      )}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Messages: failures with role="alert", progress and success with role="status". */
export function Notice({
  error,
  status,
}: {
  error?: string | null;
  status?: string | null;
}) {
  return (
    <>
      <div role="alert" className="text-sm font-medium text-destructive">
        {error}
      </div>
      <div
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {status}
      </div>
    </>
  );
}

export type ImageItem = {
  key: string;
  imageId?: string;
  file?: File;
  previewUrl: string;
};

export const ACCEPTED_IMAGES = ["image/jpeg", "image/png", "image/webp"];

let counter = 0;
export const itemKey = () => `item-${++counter}`;

/** Pick, preview, reorder and remove up to `max` images. The first is the main image. */
export function ImagePicker({
  label,
  hint,
  images,
  onChange,
  max = 10,
  disabled,
}: {
  label: string;
  hint: string;
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  max?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const created = useRef(new Set<string>());
  useEffect(() => {
    const urls = created.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const add = (files: FileList | null) => {
    if (!files) return;
    const added = [...files]
      .filter((file) => ACCEPTED_IMAGES.includes(file.type))
      .slice(0, max - images.length)
      .map((file) => {
        const previewUrl = URL.createObjectURL(file);
        created.current.add(previewUrl);
        return { key: itemKey(), file, previewUrl };
      });
    onChange([...images, ...added]);
  };
  const move = (index: number, by: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
      {images.length > 0 && (
        <ol
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          aria-label={`${label}, in order`}
        >
          {images.map((image, index) => (
            <li key={image.key} className="space-y-1 rounded-md border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- previews of local files and private images */}
              <img
                src={image.previewUrl}
                alt={`${label} ${index + 1}${index === 0 ? " (main image)" : ""}`}
                className="aspect-square w-full rounded object-cover"
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move image ${index + 1} earlier`}
                >
                  ←
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === images.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move image ${index + 1} later`}
                >
                  →
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onChange(images.filter((item) => item.key !== image.key))
                  }
                  aria-label={`Remove image ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {images.length < max && (
        <div>
          <Label htmlFor={id} className="sr-only">
            Add images to {label}
          </Label>
          <input
            id={id}
            type="file"
            multiple
            accept={ACCEPTED_IMAGES.join(",")}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              add(event.target.files);
              event.target.value = "";
            }}
            className="block text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
      )}
    </fieldset>
  );
}
