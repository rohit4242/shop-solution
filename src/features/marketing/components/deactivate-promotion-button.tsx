"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";

export function DeactivatePromotionButton({
  promotionId,
  name,
}: {
  promotionId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deactivate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/marketing/promotions/${promotionId}/deactivate`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error?.message ?? "Could not deactivate. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={deactivate}
        disabled={pending}
        aria-label={`Deactivate ${name}`}
      >
        {pending ? "Deactivating…" : "Deactivate"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
