import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-foreground">404</h1>
        <p className="mt-3 text-muted-foreground">That page does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
        >
          Back to overview
        </Link>
      </div>
    </div>
  );
}
