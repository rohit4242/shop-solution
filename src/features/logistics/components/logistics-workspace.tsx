"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { logisticsRequest } from "../utils/api-client";
import {
  statuses,
  type Shipment,
  type ShipmentEvent,
  type ShipmentList,
} from "../types/shipment";

type User = { email: string; demo: boolean };
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Message({
  error,
  children,
}: {
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={`my-3 rounded-md border p-3 text-sm ${error ? "border-destructive text-destructive" : "bg-muted"}`}
    >
      {children}
    </p>
  );
}
function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
const reason = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "The Logistics request failed. Please try again.";
const input = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export function LogisticsWorkspace({
  storefrontUrl = "",
}: {
  storefrontUrl?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [list, setList] = useState<ShipmentList | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [filters, setFilters] = useState({
    orderId: "",
    customerId: "",
    status: "",
  });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [shipmentId, setShipmentId] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [events, setEvents] = useState<ShipmentEvent[]>([]);
  const [trackBusy, setTrackBusy] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [createError, setCreateError] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [updateError, setUpdateError] = useState(false);
  const createForm = useRef<HTMLFormElement>(null);
  const trackGeneration = useRef(0);
  const listGeneration = useRef(0);
  async function loadList(page = 1, f = activeFilters) {
    const generation = ++listGeneration.current;
    setListBusy(true);
    setListError("");
    const q = new URLSearchParams({ page: String(page), pageSize: "20" });
    for (const [key, value] of Object.entries(f))
      if (value.trim()) q.set(key, value.trim());
    try {
      const result = await logisticsRequest<ShipmentList>(`?${q}`);
      if (generation === listGeneration.current) setList(result);
    } catch (e) {
      if (generation === listGeneration.current) {
        setList(null);
        setListError(reason(e));
      }
    } finally {
      if (generation === listGeneration.current) setListBusy(false);
    }
  }
  useEffect(() => {
    fetch("/api/v1/logistics/session")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setDemo(d.demo);
        setSessionReady(true);
      })
      .catch(() => {
        setLoginError("Unable to check your session. Reload to try again.");
        setSessionReady(true);
      });
  }, []);
  useEffect(() => {
    if (user) {
      const q = new URLSearchParams({ page: "1", pageSize: "20" });
      logisticsRequest<ShipmentList>(`?${q}`)
        .then(setList)
        .catch((e) => setListError(reason(e)));
    }
  }, [user]);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/v1/logistics/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: input(f, "email"),
          password: input(f, "password"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setUser({ email: "staff@logistics.demo", demo: true });
    } catch (e) {
      setLoginError(reason(e));
    } finally {
      setLoginBusy(false);
    }
  }
  async function track(id = shipmentId) {
    const generation = ++trackGeneration.current;
    setShipmentId(id);
    setShipment(null);
    setEvents([]);
    setTrackError("");
    setHistoryError("");
    setUpdateMessage("");
    if (!/^S-[0-9]{4,}$/.test(id)) {
      setTrackBusy(false);
      setHistoryBusy(false);
      setTrackError("Please enter a Shipment ID like S-2001.");
      return;
    }
    setTrackBusy(true);
    try {
      const s = await logisticsRequest<Shipment>(`/${id}`);
      if (generation !== trackGeneration.current) return;
      setShipment(s);
      setHistoryBusy(true);
      try {
        const history = await logisticsRequest<{ data: ShipmentEvent[] }>(
          `/${id}/events`,
        );
        if (generation === trackGeneration.current) setEvents(history.data);
      } catch (e) {
        if (generation === trackGeneration.current) setHistoryError(reason(e));
      }
    } catch (e) {
      if (generation === trackGeneration.current) setTrackError(reason(e));
    } finally {
      if (generation === trackGeneration.current) {
        setTrackBusy(false);
        setHistoryBusy(false);
      }
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateMessage("");
    setCreateError(false);
    const f = new FormData(e.currentTarget);
    const orderId = input(f, "orderId");
    if (!/^(O|M|ORD)-[0-9]+$/.test(orderId)) {
      setCreateError(true);
      setCreateMessage("Please enter an Order ID like O-1 or M-1.");
      return;
    }
    const address = Object.fromEntries(
      ["recipientName", "street", "postalCode", "city", "country"].map((k) => [
        k,
        input(f, k),
      ]),
    );
    if (!/^[A-Z]{2}$/.test(address.country)) {
      setCreateError(true);
      setCreateMessage("Use a two-letter country code such as DE.");
      return;
    }
    setCreateBusy(true);
    try {
      const s = await logisticsRequest<Shipment>("", {
        method: "POST",
        body: JSON.stringify({
          orderId,
          customerId: input(f, "customerId"),
          paymentStatus: input(f, "paymentStatus"),
          shippingAddress: address,
          shippingMethod: input(f, "shippingMethod"),
        }),
      });
      setCreateMessage(`Shipment ${s.shipmentId} created.`);
      await track(s.shipmentId);
      await loadList();
    } catch (e) {
      setCreateError(true);
      setCreateMessage(reason(e));
    } finally {
      setCreateBusy(false);
    }
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shipment) return;
    setUpdateMessage("");
    setUpdateError(false);
    const f = new FormData(e.currentTarget);
    const occurredAt = input(f, "occurredAt");
    if (
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(occurredAt) ||
      Number.isNaN(Date.parse(occurredAt)) ||
      new Date(occurredAt).toISOString() !== occurredAt
    ) {
      setUpdateError(true);
      setUpdateMessage(
        "Use a valid UTC timestamp like 2026-11-17T09:00:00.000Z.",
      );
      return;
    }
    setUpdateBusy(true);
    try {
      const result = await logisticsRequest<{
        shipment: Shipment;
        events: ShipmentEvent[];
      }>(`/${shipment.shipmentId}/status-updates`, {
        method: "POST",
        body: JSON.stringify({ status: input(f, "status"), occurredAt }),
      });
      setShipment(result.shipment);
      setUpdateMessage(
        result.events.length
          ? "Carrier report recorded."
          : "No change: this report was already recorded.",
      );
      setHistoryBusy(true);
      setHistoryError("");
      try {
        const h = await logisticsRequest<{ data: ShipmentEvent[] }>(
          `/${shipment.shipmentId}/events`,
        );
        setEvents(h.data);
      } catch (e) {
        setHistoryError(reason(e));
      } finally {
        setHistoryBusy(false);
      }
      await loadList();
    } catch (e) {
      setUpdateError(true);
      setUpdateMessage(reason(e));
    } finally {
      setUpdateBusy(false);
    }
  }
  function fixture() {
    const values: Record<string, string> = {
      orderId: "O-3001",
      customerId: "C-1",
      recipientName: "Erika Mustermann",
      street: "Hauptstrasse 1",
      postalCode: "94469",
      city: "Deggendorf",
      country: "DE",
      shippingMethod: "STANDARD",
      paymentStatus: "PAID",
    };
    for (const [key, value] of Object.entries(values)) {
      const field = createForm.current?.elements.namedItem(key) as
        HTMLInputElement | HTMLSelectElement | null;
      if (field) field.value = value;
    }
  }
  return (
    <main className="logistics-module mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Logistics</h1>
        </div>
        <nav aria-label="Module navigation" className="flex items-center gap-4">
          <Link className="underline" href="/">
            Storefront home
          </Link>
          <Link className="underline" href="/logistics">
            Logistics
          </Link>
          {user && (
            <Button
              variant="outline"
              onClick={async () => {
                if (user.demo) {
                  const r = await fetch("/api/v1/logistics/session", {
                    method: "DELETE",
                  });
                  if (r.ok) window.location.reload();
                } else router.push("/login");
              }}
            >
              {user.demo ? "Sign out" : "Manage login"}
            </Button>
          )}
        </nav>
      </header>

      {!sessionReady ? (
        <Message>Checking session…</Message>
      ) : !user ? (
        <div className="max-w-lg">
          <Section title="Sign in to Logistics">
            {demo ? (
              <form onSubmit={login} className="space-y-4">
                <Field id="email" label="Email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    defaultValue="staff@logistics.demo"
                    autoComplete="username"
                  />
                </Field>
                <Field id="password" label="Password">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </Field>

                <Button disabled={loginBusy}>
                  {loginBusy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            ) : (
              <Link className="underline" href="/login">
                Open common login
              </Link>
            )}
            {loginError && <Message error>{loginError}</Message>}
          </Section>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email}
          </p>
          <Section
            title="Find shipments"
            description="Search by the order, customer or delivery status."
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  filters.orderId &&
                  !/^(O|M|ORD)-[0-9]+$/.test(filters.orderId.trim())
                ) {
                  setListError("Please enter an Order ID like O-1 or M-1.");
                  return;
                }
                setActiveFilters(filters);
                void loadList(1, filters);
              }}
              className="grid items-end gap-4 md:grid-cols-4"
            >
              <Field id="filter-order" label="Order ID filter">
                <Input
                  id="filter-order"
                  value={filters.orderId}
                  onChange={(e) =>
                    setFilters({ ...filters, orderId: e.target.value })
                  }
                  placeholder="O-3001"
                />
              </Field>
              <Field id="filter-customer" label="Customer ID filter">
                <Input
                  id="filter-customer"
                  value={filters.customerId}
                  onChange={(e) =>
                    setFilters({ ...filters, customerId: e.target.value })
                  }
                  placeholder="C-1"
                />
              </Field>
              <Field id="filter-status" label="Status filter">
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">All statuses</option>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Button disabled={listBusy}>
                {listBusy ? "Searching…" : "Search"}
              </Button>
            </form>
            {listBusy ? (
              <Message>Loading shipments…</Message>
            ) : listError ? (
              <Message error>{listError}</Message>
            ) : !list ? (
              <Message>Loading shipments…</Message>
            ) : !list.data.length ? (
              <Message>No shipments match your filters.</Message>
            ) : (
              <>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Shipments matching current filters
                    </caption>
                    <thead>
                      <tr className="border-b">
                        {[
                          "Shipment",
                          "Order",
                          "Status",
                          "Carrier",
                          "Action",
                        ].map((x) => (
                          <th className="p-3" scope="col" key={x}>
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {list.data.map((s) => (
                        <tr className="border-b" key={s.shipmentId}>
                          <td className="p-3 font-medium">{s.shipmentId}</td>
                          <td className="p-3">{s.orderId}</td>
                          <td className="p-3">{s.status}</td>
                          <td className="p-3">{s.carrierCode}</td>
                          <td className="p-3">
                            <Button
                              variant="outline"
                              disabled={updateBusy}
                              onClick={() => void track(s.shipmentId)}
                              aria-label={`Open ${s.shipmentId}`}
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <p>
                    {list.pagination.totalItems} shipments · Page{" "}
                    {list.pagination.page} of {list.pagination.totalPages}
                  </p>
                  <Button
                    variant="outline"
                    disabled={list.pagination.page <= 1}
                    onClick={() => void loadList(list.pagination.page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      list.pagination.page >= list.pagination.totalPages
                    }
                    onClick={() => void loadList(list.pagination.page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </Section>
          <div className="grid items-start gap-6 lg:grid-cols-[1.15fr_1fr]">
            <div className="space-y-6">
              <Section
                title="Track a shipment"
                description="Use the ERP Shipment ID, not the carrier tracking number."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void track();
                  }}
                  className="flex flex-wrap items-end gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <Field id="shipment-id" label="Shipment ID">
                      <Input
                        id="shipment-id"
                        value={shipmentId}
                        onChange={(e) => setShipmentId(e.target.value)}
                        placeholder="S-2001"
                      />
                    </Field>
                  </div>
                  <Button disabled={trackBusy || updateBusy}>
                    {trackBusy ? "Looking up…" : "Track"}
                  </Button>
                </form>
                {trackError ? (
                  <Message error>{trackError}</Message>
                ) : trackBusy ? (
                  <Message>Looking up…</Message>
                ) : !shipment ? (
                  <Message>
                    Enter a shipment ID to see its delivery history.
                  </Message>
                ) : (
                  <div
                    data-testid="shipment-details"
                    className="mt-5 space-y-4"
                  >
                    <h3 className="text-lg font-semibold">
                      {shipment.shipmentId}{" "}
                      <span className="ml-2 inline-block rounded-md border bg-muted px-2 py-1 text-xs">
                        {shipment.status}
                      </span>
                    </h3>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries({
                        "Order ID": shipment.orderId,
                        "Customer ID": shipment.customerId,
                        Carrier: shipment.carrierCode,
                        "Tracking number": shipment.trackingNumber,
                        "Shipping method": shipment.shippingMethod,
                        "Failed attempts": shipment.failedAttempts,
                        "Last update (UTC)": shipment.updatedAt,
                      }).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <dt className="text-muted-foreground">{k}</dt>
                          <dd className="break-words font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {(storefrontUrl || demo) && (
                      <a
                        className="inline-block underline"
                        href={
                          storefrontUrl
                            ? `${storefrontUrl}${encodeURIComponent(shipment.orderId)}`
                            : `/logistics/demo/storefront?orderId=${encodeURIComponent(shipment.orderId)}`
                        }
                      >
                        View order in Storefront
                        {storefrontUrl ? "" : " (demo stub)"}
                      </a>
                    )}
                    <h3 className="border-t pt-4 font-semibold">
                      Status history
                    </h3>
                    {historyBusy ? (
                      <Message>Loading history…</Message>
                    ) : historyError ? (
                      <Message error>{historyError}</Message>
                    ) : !events.length ? (
                      <p className="text-sm text-muted-foreground">
                        No status changes yet.
                      </p>
                    ) : (
                      <ol aria-label="Status history" className="space-y-3">
                        {events.map((event, i) => (
                          <li
                            key={`${event.updatedAt}-${i}`}
                            className="rounded-md border p-3 text-sm"
                          >
                            <p className="font-medium">
                              {event.previousStatus} → {event.status}
                            </p>
                            <p>{event.updatedAt}</p>
                            <p className="text-muted-foreground">
                              Failed attempts at event:{" "}
                              {event.attemptCount ?? "unavailable"}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Section>
              {shipment && (
                <Section
                  title="Record a carrier report"
                  description="Enter only the status and UTC time actually reported by the carrier. No intermediate events are invented."
                >
                  <form onSubmit={update} className="space-y-4">
                    <Field id="reported-status" label="Reported status">
                      <select
                        id="reported-status"
                        name="status"
                        disabled={updateBusy}
                      >
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <Field id="occurred-at" label="Reported time (UTC)">
                      <Input
                        id="occurred-at"
                        name="occurredAt"
                        required
                        placeholder="2026-11-17T09:00:00.000Z"
                        disabled={updateBusy}
                      />
                    </Field>
                    <p className="text-sm text-muted-foreground">
                      Must be at or after the shipment’s last update, with
                      milliseconds and Z.
                    </p>
                    <Button disabled={updateBusy || trackBusy}>
                      {updateBusy ? "Recording…" : "Apply update"}
                    </Button>
                  </form>
                  {updateMessage && (
                    <Message error={updateError}>{updateMessage}</Message>
                  )}
                </Section>
              )}
            </div>
            <Section
              title="Create a shipment"
              description="Create one shipment for a paid order. Payment must be confirmed upstream; this form does not verify payment."
            >
              {demo && (
                <Button
                  type="button"
                  variant="outline"
                  className="mb-4"
                  onClick={fixture}
                >
                  Use demo paid order
                </Button>
              )}
              <form ref={createForm} onSubmit={create} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="order-id" label="Order ID">
                    <Input
                      id="order-id"
                      name="orderId"
                      required
                      placeholder="O-3001"
                    />
                  </Field>
                  <Field id="customer-id" label="Customer ID">
                    <Input
                      id="customer-id"
                      name="customerId"
                      required
                      placeholder="C-1"
                    />
                  </Field>
                </div>
                <Field id="payment-status" label="Payment status">
                  <select id="payment-status" name="paymentStatus">
                    <option>PAID</option>
                  </select>
                </Field>
                <Field id="recipient" label="Recipient name">
                  <Input id="recipient" name="recipientName" required />
                </Field>
                <Field id="street" label="Street">
                  <Input id="street" name="street" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="postal" label="Postal code">
                    <Input id="postal" name="postalCode" required />
                  </Field>
                  <Field id="city" label="City">
                    <Input id="city" name="city" required />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="country" label="Country code">
                    <Input
                      id="country"
                      name="country"
                      required
                      maxLength={2}
                      placeholder="DE"
                    />
                  </Field>
                  <Field id="method" label="Shipping method">
                    <select id="method" name="shippingMethod">
                      <option>STANDARD</option>
                      <option>EXPRESS</option>
                    </select>
                  </Field>
                </div>
                <Button disabled={createBusy}>
                  {createBusy ? "Creating…" : "Create shipment"}
                </Button>
              </form>
              {createMessage && (
                <Message error={createError}>{createMessage}</Message>
              )}
            </Section>
          </div>
        </>
      )}
      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Logistics · Session 6 · Contract v1.3.0 · Data is in memory and resets
        on restart.
      </footer>
    </main>
  );
}
