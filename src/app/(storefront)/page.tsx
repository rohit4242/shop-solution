import { Button } from "@/shared/components/ui/button";
export default function Home() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-20">
      <p className="text-sm text-zinc-500">Agent-Based Software Development</p>
      <h1 className="text-4xl font-semibold">Shop Solution</h1>
      <p className="text-lg text-zinc-600">
        One shared application. Ten feature teams.
      </p>
      <p>
        The project foundation is ready for team development. Authentication,
        commerce features and team interfaces are developed through reviewed
        pull requests.
      </p>
      <Button asChild>
        <a href="/api/health">Check application health</a>
      </Button>
    </main>
  );
}
