import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Heavy Highway Estimator</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">Sign in to continue.</p>
      <LoginForm next={next ?? "/"} />
    </div>
  );
}
