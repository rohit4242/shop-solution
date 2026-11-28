"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type { MyShop, SellerAccount } from "../types/marketplace";
import { api, errorText } from "../utils/api-client";
import { Notice } from "./form-parts";
import { ProductForm } from "./product-form";
import { SellerDashboard } from "./seller-dashboard";
import { SellerSignIn } from "./seller-sign-in";
import { ShopForm, type ShopValues } from "./shop-form";

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "setup"; step: 1; rejectedReason: string | null }
  | { kind: "setup"; step: 2; seller: SellerAccount }
  | { kind: "dashboard"; seller: SellerAccount; notice: string | null };

/** The /seller page: sign in, set up a shop in two steps, then the dashboard. */
export function SellerWorkspace({ signedIn }: { signedIn: boolean }) {
  const [view, setView] = useState<View>({ kind: "loading" });

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<MyShop>("GET", "/sellers/me").then((result) => {
      if (!live) return;
      if (!result.ok)
        return setView({ kind: "error", message: errorText(result) });
      setView(
        result.data.seller
          ? { kind: "dashboard", seller: result.data.seller, notice: null }
          : {
              kind: "setup",
              step: 1,
              rejectedReason: result.data.rejectedReason,
            },
      );
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!signedIn) return <SellerSignIn />;
  if (view.kind === "loading")
    return <p aria-live="polite">Loading your shop …</p>;
  if (view.kind === "error") return <Notice error={view.message} />;
  if (view.kind === "dashboard")
    return <SellerDashboard seller={view.seller} notice={view.notice} />;

  async function register(values: ShopValues): Promise<string | null> {
    const result = await api<SellerAccount>("POST", "/sellers", values);
    if (!result.ok) return errorText(result);
    setView({ kind: "setup", step: 2, seller: result.data });
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Start selling</p>
        <h1 className="text-3xl font-semibold">
          {view.step === 1 ? "Set up your shop" : "Add your first product"}
        </h1>
        <ol aria-label="Shop setup" className="flex gap-4 text-sm">
          {["Your shop", "Your first product"].map((label, index) => (
            <li
              key={label}
              aria-current={view.step === index + 1 ? "step" : undefined}
              className={
                view.step === index + 1
                  ? "font-semibold"
                  : "text-muted-foreground"
              }
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>
      </header>
      {view.step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your shop</CardTitle>
            {view.rejectedReason && (
              <p className="text-sm">
                Your last registration was rejected: {view.rejectedReason}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <ShopForm submitLabel="Save and continue" onSubmit={register} />
          </CardContent>
        </Card>
      ) : (
        <ProductForm
          sellerId={view.seller.sellerId}
          submitLabel="Submit for review"
          onSaved={() =>
            setView({
              kind: "dashboard",
              seller: view.seller,
              notice:
                "Your shop is set up. Your product was submitted for review.",
            })
          }
          secondaryAction={
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setView({
                  kind: "dashboard",
                  seller: view.seller,
                  notice: "Your shop is set up.",
                })
              }
            >
              Skip for now
            </Button>
          }
        />
      )}
    </div>
  );
}
