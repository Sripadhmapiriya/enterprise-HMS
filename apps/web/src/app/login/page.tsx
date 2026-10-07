'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@enterprise-hms/ui';
import { authApi } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // MFA state
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  // Status & error handling
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      authApi.getDemoAccounts()
        .then((res) => {
          if (res.success && res.data) {
            setDemoAccounts(res.data);
          }
        })
        .catch(() => {
          // Silent catch
        });
    }
  }, []);

  const applyCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      // Submits to backend endpoint /api/v1/auth/login via authApi
      const res = await authApi.login({ email: demoEmail, password: demoPass });

      if (res.data?.mfaRequired) {
        setIsMfaRequired(true);
        setIsLoading(false);
        return;
      }

      if (res.data?.accessToken) {
        localStorage.setItem('hms_access_token', res.data.accessToken);
        if (res.data.refreshToken) localStorage.setItem('hms_refresh_token', res.data.refreshToken);
        if (res.data.user?.tenantId) localStorage.setItem('hms_tenant_id', res.data.user.tenantId);
        if (res.data.user) localStorage.setItem('hms_user', JSON.stringify(res.data.user));
      }

      setSuccessMessage('Authentication verified! Loading clinical workspace...');
      const params = new URLSearchParams(window.location.search);
      const target = params.get('redirect') || '/dashboard';
      setTimeout(() => {
        window.location.href = target;
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isMfaRequired) {
        // Submit MFA verification
        const res = await authApi.verifyMfa({ email, token: mfaCode });
        if (res.data?.accessToken) {
          localStorage.setItem('hms_access_token', res.data.accessToken);
          if (res.data.refreshToken) localStorage.setItem('hms_refresh_token', res.data.refreshToken);
          if (res.data.user?.tenantId) localStorage.setItem('hms_tenant_id', res.data.user.tenantId);
          if (res.data.user) localStorage.setItem('hms_user', JSON.stringify(res.data.user));
        }
        setSuccessMessage('Authentication verified. Redirecting to workspace...');
        const params = new URLSearchParams(window.location.search);
        const target = params.get('redirect') || '/dashboard';
        setTimeout(() => {
          window.location.href = target;
        }, 600);
      } else {
        // Submits to backend endpoint /api/v1/auth/login via authApi
        const res = await authApi.login({ email, password });

        if (res.data?.mfaRequired) {
          setIsMfaRequired(true);
          setIsLoading(false);
          return;
        }

        if (res.data?.accessToken) {
          localStorage.setItem('hms_access_token', res.data.accessToken);
          if (res.data.refreshToken) localStorage.setItem('hms_refresh_token', res.data.refreshToken);
          if (res.data.user?.tenantId) localStorage.setItem('hms_tenant_id', res.data.user.tenantId);
          if (res.data.user) localStorage.setItem('hms_user', JSON.stringify(res.data.user));
        }

        setSuccessMessage('Login successful. Loading clinical workspace...');
        const params = new URLSearchParams(window.location.search);
        const target = params.get('redirect') || '/dashboard';
        setTimeout(() => {
          window.location.href = target;
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-brand flex items-center justify-center text-brand-foreground shadow-md">
            <Activity className="w-6 h-6" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight text-text">
            Enterprise <span className="text-brand">HMS</span>
          </span>
        </div>

        <h2 className="text-center text-xl font-semibold text-text">
          Clinical & Enterprise Portal
        </h2>
        <p className="mt-1 text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          <span>Unified Hospital Management System</span>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-surface py-8 px-6 shadow-sm border border-border rounded-xl sm:px-10">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-critical-bg border border-critical-border text-critical-text text-xs"
            >
              <AlertCircle className="w-4 h-4 text-critical shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div
              role="status"
              className="mb-5 flex items-center gap-2 p-3 rounded-lg bg-stable-bg border border-stable-border text-stable-text text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-stable shrink-0" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isMfaRequired ? (
              <>
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-text mb-1">
                    Work Email Address <span className="text-critical">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3 text-text-muted pointer-events-none" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="physician@hospital.org"
                      className="w-full text-xs rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-xs font-semibold text-text">
                      Password <span className="text-critical">*</span>
                    </label>
                    <a
                      href="#forgot-password"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Please contact your hospital IT administrator to reset credentials.');
                      }}
                      className="text-xs text-brand hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3 text-text-muted pointer-events-none" aria-hidden="true" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full text-xs rounded-md border border-border bg-surface pl-9 pr-9 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 text-text-muted hover:text-text cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-xs text-text-muted cursor-pointer">
                    Remember this workstation for 30 days
                  </label>
                </div>
              </>
            ) : (
              /* Two-Factor Authentication Step */
              <div className="space-y-4">
                <div className="p-3 bg-info-bg border border-info-border rounded-lg text-xs text-info-text">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-brand" aria-hidden="true" />
                    <span>Two-Factor Authentication Required</span>
                  </div>
                  Enter the 6-digit verification code from your authenticator app.
                </div>

                <div>
                  <label htmlFor="mfa-code" className="block text-xs font-semibold text-text mb-1">
                    Security Passcode <span className="text-critical">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 absolute left-3 text-text-muted pointer-events-none" aria-hidden="true" />
                    <input
                      id="mfa-code"
                      type="text"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      required
                      autoFocus
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      className="w-full text-center tracking-widest text-lg font-mono rounded-md border border-border bg-surface py-2 text-text focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMfaRequired(false)}
                  className="text-xs text-text-muted hover:text-text underline block text-center w-full"
                >
                  ← Back to Email and Password
                </button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
              className="w-full mt-2"
            >
              {isMfaRequired ? 'Verify & Continue' : 'Sign in to Dashboard'}
            </Button>
          </form>

          {/* Quick Demo Credentials */}
          {demoAccounts.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Quick Demo Access
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickLogin(account.email, 'password123')}
                    className="flex flex-col items-start p-2.5 bg-surface-subtle border border-border rounded-lg hover:border-brand hover:bg-surface-raised transition-all text-left cursor-pointer disabled:opacity-50"
                  >
                    <div className="font-semibold text-xs text-text mb-0.5">
                      {account.role}
                    </div>
                    <div className="text-[11px] text-text-muted truncate w-full">
                      {account.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compliance & Security Audit Footnote */}
          <div className="mt-6 pt-5 border-t border-border text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-stable" aria-hidden="true" />
              <span>Protected Health Information (PHI) Secure System</span>
            </div>
            <p className="mt-1 text-[10px] text-text-muted max-w-xs mx-auto leading-relaxed">
              Authorized clinical personnel only. All access, lookups, and modifications are
              cryptographically logged and audited for compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
