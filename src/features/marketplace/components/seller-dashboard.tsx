"use client";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  CATEGORY_LABELS,
  type Offer,
  type OfferStatus,
  type SaleLine,
  type SellerAccount,
} from "../types/marketplace";
import { api, errorText } from "../utils/api-client";
import { formatMoney } from "../utils/money";
import { Notice } from "./form-parts";
import { ProductForm } from "./product-form";
import { ShopForm, type ShopValues } from "./shop-form";

export const SHOP_STATUS: Record<SellerAccount["status"], string> = {
  pending: "Waiting for approval",
  active: "Active",
  suspended: "Suspended",
  terminated: "Closed",
};
const OFFER_STATUS: Record<OfferStatus, string> = {
  draft: "Draft",
  pending: "In review",
  active: "Live",
  rejected: "Needs changes",
  blocked: "Blocked",
  removed: "Removed",
};

const statusText = (offer: Offer) =>
  offer.status === "rejected" && offer.statusReason
    ? `Needs changes: ${offer.statusReason}`
    : OFFER_STATUS[offer.status];

const canList = (seller: SellerAccount) =>
  seller.status === "pending" || seller.status === "active";

export function SellerDashboard({
  seller: initialSeller,
  notice,
}: {
  seller: SellerAccount;
  notice?: string | null;
}) {
  const [seller, setSeller] = useState(initialSeller);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [sales, setSales] = useState<SaleLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(notice ?? null);

  useEffect(() => {
    let live = true;
    Promise.all([
      api<Offer[]>("GET", `/offers?sellerId=${seller.sellerId}`),
      api<SaleLine[]>("GET", `/sales?sellerId=${seller.sellerId}`),
    ]).then(([offerResult, saleResult]) => {
      if (!live) return;
      if (!offerResult.ok) return setError(errorText(offerResult));
      if (!saleResult.ok) return setError(errorText(saleResult));
      setOffers(offerResult.data);
      setSales(saleResult.data);
    });
    return () => {
      live = false;
    };
  }, [seller.sellerId]);

  const count = (state: OfferStatus) =>
    offers?.filter((o) => o.status === state).length ?? 0;
  const soldFor = sales?.reduce((sum, line) => sum + line.grossMinor, 0) ?? 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Your shop</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{seller.displayName}</h1>
          <span className="rounded-full border px-3 py-1 text-sm">
            Status: {SHOP_STATUS[seller.status]}
          </span>
        </div>
        {seller.status === "pending" && (
          <p className="text-muted-foreground">
            Your shop is waiting for approval. You can already add products;
            they go public once the shop and the product are approved.
          </p>
        )}
      </header>
      <Notice error={error} status={status} />

      {offers === null || sales === null ? (
        !error && <p aria-live="polite">Loading your shop …</p>
      ) : (
        <>
          <dl
            aria-label="Overview"
            className="grid grid-cols-2 gap-3 sm:grid-cols-5"
          >
            {[
              ["Live products", String(count("active"))],
              ["In review", String(count("pending"))],
              ["Need changes", String(count("rejected"))],
              ["Sales", String(sales.length)],
              ["Sold for", formatMoney(soldFor)],
            ].map(([label, value]) => (
              <Card
                key={label}
                className={
                  label === "Need changes" && count("rejected") > 0
                    ? "border-destructive"
                    : undefined
                }
              >
                <CardContent className="space-y-1 p-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold">{value}</dd>
                </CardContent>
              </Card>
            ))}
          </dl>

          <Tabs defaultValue="products">
            <TabsList aria-label="Your shop">
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="shop">Shop details</TabsTrigger>
            </TabsList>
            <TabsContent value="products">
              <ProductsPanel
                seller={seller}
                offers={offers}
                onSaved={(offer, message) => {
                  setOffers((list) => [
                    offer,
                    ...(list ?? []).filter((o) => o.offerId !== offer.offerId),
                  ]);
                  setError(null);
                  setStatus(message);
                }}
              />
            </TabsContent>
            <TabsContent value="sales">
              <SalesPanel
                sales={sales}
                offers={offers}
                onChanged={(line) =>
                  setSales((list) =>
                    (list ?? []).map((l) =>
                      l.saleId === line.saleId ? line : l,
                    ),
                  )
                }
              />
            </TabsContent>
            <TabsContent value="shop">
              <ShopPanel seller={seller} onSaved={setSeller} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ProductsPanel({
  seller,
  offers,
  onSaved,
}: {
  seller: SellerAccount;
  offers: Offer[];
  onSaved: (offer: Offer, message: string) => void;
}) {
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  return (
    <section className="space-y-4" aria-labelledby="products-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="products-heading" className="text-xl font-semibold">
          Products
        </h2>
        {canList(seller) && editing === null && (
          <Button onClick={() => setEditing("new")}>Add product</Button>
        )}
      </div>
      {editing !== null && (
        <section aria-labelledby="product-form-heading" className="space-y-3">
          <h3 id="product-form-heading" className="text-lg font-semibold">
            {editing === "new" ? "New product" : `Edit ${editing.name}`}
          </h3>
          <ProductForm
            key={editing === "new" ? "new" : editing.offerId}
            sellerId={seller.sellerId}
            offer={editing === "new" ? undefined : editing}
            submitLabel={
              editing === "new" ? "Submit for review" : "Save changes"
            }
            onCancel={() => setEditing(null)}
            onSaved={({ offer, message }) => {
              setEditing(null);
              onSaved(offer, message);
            }}
          />
        </section>
      )}
      {offers.length === 0 ? (
        <p className="text-muted-foreground">
          You have no products yet. Add your first one to start selling.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                {[
                  "Product",
                  "Category",
                  "Price",
                  "Stock",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.offerId} className="border-b align-top">
                  <td className="py-2 pr-4 font-medium">{offer.name}</td>
                  <td className="py-2 pr-4">
                    {CATEGORY_LABELS[offer.category] ?? offer.category}
                  </td>
                  <td className="py-2 pr-4">
                    {offer.variations.length > 1 &&
                    offer.maximumPriceMinor !== offer.startingPriceMinor
                      ? `from ${formatMoney(offer.startingPriceMinor)}`
                      : formatMoney(offer.priceMinor)}
                  </td>
                  <td className="py-2 pr-4">{offer.stock}</td>
                  <td className="py-2 pr-4">{statusText(offer)}</td>
                  <td className="py-2 pr-4">
                    {offer.status !== "blocked" &&
                      offer.status !== "removed" &&
                      canList(seller) && (
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Edit ${offer.name}`}
                          onClick={() => setEditing(offer)}
                        >
                          Edit
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SalesPanel({
  sales,
  offers,
  onChanged,
}: {
  sales: SaleLine[];
  offers: Offer[];
  onChanged: (line: SaleLine) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const names = new Map(offers.map((o) => [o.offerId, o.name]));

  async function resend(line: SaleLine) {
    setBusy(line.saleId);
    setError(null);
    setStatus(null);
    const result = await api<SaleLine>(
      "POST",
      `/sales/${line.saleId}/accounting-handoff`,
    );
    setBusy(null);
    if (!result.ok) return setError(errorText(result));
    onChanged(result.data);
    setStatus(`Sent to Accounting. Booked as ${result.data.invoiceId}.`);
  }

  return (
    <section className="space-y-3" aria-labelledby="sales-heading">
      <h2 id="sales-heading" className="text-xl font-semibold">
        Sales
      </h2>
      <p className="text-sm text-muted-foreground">
        Commission and payouts are calculated by Accounting; you find them in
        Accounting&apos;s statements.
      </p>
      <Notice error={error} status={status} />
      {sales.length === 0 ? (
        <p className="text-muted-foreground">
          No sales yet. Sales appear here as soon as buyers order your live
          products.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                {[
                  "Order",
                  "Product",
                  "Quantity",
                  "Unit price",
                  "Sold for",
                  "Sold",
                  "Accounting",
                ].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map((line) => (
                <tr key={line.saleId} className="border-b align-top">
                  <td className="py-2 pr-4 font-mono text-xs">
                    {line.orderId}
                  </td>
                  <td className="py-2 pr-4">
                    {names.get(line.offerId) ?? line.offerId}
                  </td>
                  <td className="py-2 pr-4">{line.quantity}</td>
                  <td className="py-2 pr-4">
                    {formatMoney(line.unitPriceMinor)}
                  </td>
                  <td className="py-2 pr-4">{formatMoney(line.grossMinor)}</td>
                  <td className="py-2 pr-4">{line.soldAt.slice(0, 10)}</td>
                  <td className="space-y-1 py-2 pr-4">
                    <div>
                      {line.invoiceStatus === "invoiced"
                        ? `Booked · ${line.invoiceId}`
                        : line.invoiceStatus === "pending"
                          ? "Waiting for Accounting"
                          : "Refused by Accounting"}
                    </div>
                    {line.invoiceStatus !== "invoiced" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        aria-label={`Send ${line.orderId} to Accounting again`}
                        onClick={() => resend(line)}
                      >
                        Send again
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ShopPanel({
  seller,
  onSaved,
}: {
  seller: SellerAccount;
  onSaved: (seller: SellerAccount) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save(values: ShopValues): Promise<string | null> {
    const changes: Partial<ShopValues> = {};
    if (values.displayName !== seller.displayName)
      changes.displayName = values.displayName;
    if (values.legalName !== seller.legalName)
      changes.legalName = values.legalName;
    if (values.contactEmail !== seller.contactEmail)
      changes.contactEmail = values.contactEmail;
    if (JSON.stringify(values.address) !== JSON.stringify(seller.address))
      changes.address = values.address;
    if (Object.keys(changes).length === 0) {
      setEditing(false);
      setStatus("Nothing changed.");
      return null;
    }
    const result = await api<SellerAccount>(
      "PATCH",
      `/sellers/${seller.sellerId}`,
      changes,
    );
    if (!result.ok) return errorText(result);
    onSaved(result.data);
    setEditing(false);
    setStatus("Shop details saved.");
    return null;
  }

  const a = seller.address;
  return (
    <section className="space-y-4" aria-labelledby="shop-heading">
      <h2 id="shop-heading" className="text-xl font-semibold">
        Shop details
      </h2>
      <Notice status={status} />
      {editing ? (
        <ShopForm
          initial={seller}
          submitLabel="Save changes"
          onSubmit={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-muted-foreground">Shop name</dt>
            <dd>{seller.displayName}</dd>
            <dt className="text-muted-foreground">Legal name</dt>
            <dd>{seller.legalName}</dd>
            <dt className="text-muted-foreground">Contact e-mail</dt>
            <dd>{seller.contactEmail}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>{`${a.street}, ${a.postalCode} ${a.city}, ${a.country}`}</dd>
            <dt className="text-muted-foreground">Seller since</dt>
            <dd>{seller.createdAt.slice(0, 10)}</dd>
          </dl>
          {canList(seller) && (
            <Button
              variant="outline"
              onClick={() => {
                setStatus(null);
                setEditing(true);
              }}
            >
              Edit shop details
            </Button>
          )}
        </>
      )}
    </section>
  );
}
