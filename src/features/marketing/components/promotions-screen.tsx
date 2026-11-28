import "server-only";

import { headers } from "next/headers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { listPromotions } from "../server/services/promotion-service";
import { checkMarketingManager } from "../server/session";
import { DeactivatePromotionButton } from "./deactivate-promotion-button";
import { PromotionForm } from "./promotion-form";

const ACCESS_MESSAGES = {
  401: "Log in with the shared shop login to manage promotions.",
  403: "Your account does not have the marketing_manager permission. Ask Admin & Identity to grant it.",
  503: "Could not check your login right now. Reload the page in a moment.",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});
const formatDate = (iso: string | null) =>
  iso ? dateTime.format(new Date(iso)) : "open end";

function scopeText(productIds: string[], categoryIds: string[]) {
  if (productIds.length === 0 && categoryIds.length === 0) return "Whole cart";
  return [
    productIds.length ? `Products: ${productIds.join(", ")}` : null,
    categoryIds.length ? `Categories: ${categoryIds.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** /marketing/promotions: the back-office screen for story step j. */
export async function PromotionsScreen() {
  const requestHeaders = await headers();
  const access = await checkMarketingManager(
    new Request("http://internal/marketing/promotions", {
      headers: requestHeaders,
    }),
  );

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-5 py-8 sm:px-8 sm:py-12">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Promotions</h1>
        <p className="text-muted-foreground">
          Automatic discounts at checkout, no code needed. Marketing.
        </p>
      </header>
      {!access.ok ? (
        <Card>
          <CardContent className="p-6">
            <p role="alert">{ACCESS_MESSAGES[access.status]}</p>
          </CardContent>
        </Card>
      ) : (
        <PromotionsContent />
      )}
    </main>
  );
}

async function PromotionsContent() {
  const promotions = await listPromotions({});
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>New promotion</CardTitle>
          <CardDescription>
            Set the discount, the products it applies to, and the period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromotionForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>All promotions</CardTitle>
          <CardDescription>
            Newest first. Promotions are deactivated, never deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <p className="text-muted-foreground">
              No promotions yet. Create one above.
            </p>
          ) : (
            // On small screens the table scrolls inside its own region, never the whole page (DESIGN.md).
            <div
              role="region"
              aria-label="Promotions table"
              tabIndex={0}
              className="relative overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Name
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Discount
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Applies to
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Period
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Status
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map((promotion) => (
                    <tr
                      key={promotion.promotionId}
                      className="border-b last:border-0"
                    >
                      <td className="py-2 pr-4">
                        <div className="font-medium">{promotion.name}</div>
                        <div className="text-muted-foreground">
                          {promotion.description}
                        </div>
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {promotion.type === "percent"
                          ? `${promotion.value} %`
                          : `${promotion.value.toFixed(2)} EUR`}
                      </td>
                      <td className="py-2 pr-4">
                        {scopeText(promotion.productIds, promotion.categoryIds)}
                      </td>
                      <td className="py-2 pr-4">
                        {formatDate(promotion.validFrom)} –{" "}
                        {formatDate(promotion.validTo)}
                      </td>
                      <td className="py-2 pr-4">
                        {promotion.active ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2">
                        {promotion.active && (
                          <DeactivatePromotionButton
                            promotionId={promotion.promotionId}
                            name={promotion.name}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
