"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/features/admin-identity";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Notice, TextField } from "./form-parts";

/**
 * INTERIM sign-in for sellers until Admin & Identity ships the shared login
 * pages (src/app/(auth)/login). Uses their public Better Auth client only.
 */
export function SellerSignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || (mode === "sign-up" && !name.trim()))
      return setError("Error: Please fill in all fields.");
    if (mode === "sign-up" && password.length < 8)
      return setError("Error: The password needs at least 8 characters.");
    setError(null);
    setBusy(true);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email: email.trim(), password })
        : await authClient.signUp.email({
            email: email.trim(),
            password,
            name: name.trim(),
          });
    setBusy(false);
    if (result.error)
      return setError(
        `Error: ${result.error.message ?? "Signing in did not work. Please check your details."}`,
      );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-3xl font-semibold">Sell on the marketplace</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="space-y-4">
            <fieldset disabled={busy} className="space-y-4">
              {mode === "sign-up" && (
                <TextField
                  label="Your name"
                  autoComplete="name"
                  value={name}
                  onChange={setName}
                />
              )}
              <TextField
                label="E-mail"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
              />
              <TextField
                label="Password"
                type="password"
                hint={mode === "sign-up" ? "At least 8 characters." : undefined}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                value={password}
                onChange={setPassword}
              />
            </fieldset>
            <Notice error={error} status={busy ? "Please wait …" : null} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setError(null);
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                }}
              >
                {mode === "sign-in"
                  ? "Create an account"
                  : "I already have an account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
