import { Link } from 'react-router-dom';
import { HelpCircle, Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex p-4 rounded-full bg-zinc-100 text-zinc-500 mb-4 border border-zinc-200">
        <HelpCircle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-bold text-zinc-900">404 - Page Not Found</h1>
      <p className="text-sm text-zinc-500 mt-2 max-w-sm mx-auto">
        The page you are looking for does not exist in this inventory application skeleton.
      </p>
      <div className="mt-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-black hover:to-zinc-900 text-white rounded-lg text-sm font-semibold shadow-sm transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
