import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, ShieldCheck, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DEMO_USERS, DEMO_PASSWORD } from '../services/api';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    usernameOrEmail?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate fields client-side
  const validateForm = (): boolean => {
    const errors: { usernameOrEmail?: string; password?: string } = {};

    const trimmedInput = usernameOrEmail.trim();
    if (!trimmedInput) {
      errors.usernameOrEmail = 'Username or email is required';
    } else if (trimmedInput.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedInput)) {
      // If the input looks like an email (contains @), validate the format
      errors.usernameOrEmail = 'Please enter a valid email address';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 8) {
      // FR-AUTH-04: minimum 8 characters
      errors.password = 'Password must be at least 8 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const loggedUser = await login(usernameOrEmail, password);

      // FR-AUTH-01 & Gherkin: Valid login opens the role's home screen
      const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;

      if (fromPath && fromPath !== '/login') {
        navigate(fromPath, { replace: true });
      } else if (loggedUser.role === 'Sales Staff') {
        navigate('/sales', { replace: true });
      } else if (loggedUser.role === 'Store Staff') {
        navigate('/inventory', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      // FR-AUTH-01 Acceptance Criteria: a wrong login shows one generic error that names no field
      const message = err instanceof Error ? err.message : 'Invalid username or password';
      setServerError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick fill helper for QA and demo review
  const handleQuickFill = (username: string) => {
    setUsernameOrEmail(username);
    setPassword(DEMO_PASSWORD);
    setFieldErrors({});
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-zinc-100 shadow-xl shadow-zinc-900/20 ring-1 ring-zinc-700">
            <ShieldCheck className="w-10 h-10 text-zinc-200" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-zinc-900">
          Sign In
        </h1>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-zinc-200/90 rounded-2xl sm:px-10">
          {/* FR-AUTH-01 Generic Server Error Banner */}
          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4.5" noValidate>
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-zinc-700 uppercase mb-1 tracking-wider"
              >
                Username or Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-username"
                  name="usernameOrEmail"
                  type="text"
                  autoComplete="username"
                  value={usernameOrEmail}
                  onChange={(e) => {
                    setUsernameOrEmail(e.target.value);
                    if (fieldErrors.usernameOrEmail) {
                      setFieldErrors((prev) => ({ ...prev, usernameOrEmail: undefined }));
                    }
                  }}
                  placeholder="user@example.com"
                  aria-invalid={!!fieldErrors.usernameOrEmail}
                  className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.usernameOrEmail
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30'
                      : 'border-zinc-200 focus:border-zinc-800 focus:ring-zinc-800 bg-zinc-50/50 focus:bg-white text-zinc-900'
                  }`}
                />
              </div>
              {fieldErrors.usernameOrEmail && (
                <p className="mt-1 text-xs text-rose-600 font-medium">
                  {fieldErrors.usernameOrEmail}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-zinc-700 uppercase mb-1 tracking-wider"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  placeholder="••••••••"
                  aria-invalid={!!fieldErrors.password}
                  className={`w-full pl-9 pr-10 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    fieldErrors.password
                      ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30'
                      : 'border-zinc-200 focus:border-zinc-800 focus:ring-zinc-800 bg-zinc-50/50 focus:bg-white text-zinc-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none focus:text-zinc-600 transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <Eye className="w-4 h-4 text-zinc-500" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 hover:from-black hover:to-zinc-800 disabled:from-zinc-400 disabled:to-zinc-500 text-white rounded-lg text-sm font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
            </button>
          </form>

          {/* Quick Demo Accounts Helper for Interns & QA Review */}
          <div className="mt-6 pt-5 border-t border-zinc-100">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
              <span>Sprint 1 Demo Test Accounts (Password: {DEMO_PASSWORD}):</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {DEMO_USERS.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  onClick={() => handleQuickFill(demo.username)}
                  className="p-2 border border-zinc-200 hover:border-zinc-400 hover:bg-zinc-100/70 rounded-lg text-left transition-all group cursor-pointer"
                >
                  <p className="font-semibold text-zinc-800 group-hover:text-zinc-950">
                    {demo.username}
                  </p>
                  <p className="text-[10px] text-zinc-400 truncate">{demo.role}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
