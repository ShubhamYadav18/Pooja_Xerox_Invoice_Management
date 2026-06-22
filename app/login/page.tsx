import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, auth } from "@/auth";
import { Button, Card, Field, Input } from "@/components/ui";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=Invalid credentials");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          <img src="/PoojaXerox_Logo.png" alt="POOJA XEROX" className="mb-4 h-20 w-auto object-contain" />
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Admin Login</p>
          <h1 className="mt-2 text-2xl font-semibold">POOJA XEROX</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage invoices, customers, GST and reports.</p>
        </div>
        {params.error ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {params.error}
          </div>
        ) : null}
        <form action={loginAction} className="grid gap-4">
          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
