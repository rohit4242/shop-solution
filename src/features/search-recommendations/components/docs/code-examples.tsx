"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shared/components/ui/tabs";
export function CodeBlock({ code }: { code: string }) {
  const [state, setState] = useState("Copy");
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("Copied");
    } catch {
      setState("Copy failed");
    }
  }
  return (
    <div className="relative rounded-lg border bg-muted/40">
      <div className="flex justify-end border-b px-2 py-1">
        <Button variant="ghost" size="sm" onClick={copy}>
          {state === "Copied" ? <Check /> : <Copy />}
          <span aria-live="polite">{state}</span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  );
}
export function CodeExamples({
  examples,
}: {
  examples: { label: string; code: string }[];
}) {
  return (
    <Tabs defaultValue={examples[0].label}>
      <TabsList aria-label="Code examples">
        {examples.map((e) => (
          <TabsTrigger key={e.label} value={e.label}>
            {e.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {examples.map((e) => (
        <TabsContent key={e.label} value={e.label}>
          <CodeBlock code={e.code} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
