import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-500">404</p>
      <h1 className="text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-md text-sm text-slate-600">
        The page you are looking for does not exist or may have moved.
      </p>
      <Link
        href="/dashboard"
        className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
