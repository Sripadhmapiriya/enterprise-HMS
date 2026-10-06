'use client';

import React, { useState } from 'react';
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Icon & Heading */}
        <div className="flex justify-center items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#0891B2] flex items-center justify-center text-white shadow-md">
            <Activity className="w-6 h-6" aria-hidden="true" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">
            Enterprise <span className="text-[#0891B2]">HMS</span>
          </span>
        </div>

        <h2 className="text-center text-xl font-semibold text-slate-800">
          Clinical & Enterprise Portal
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>Unified Hospital Management System</span>
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {successMessage && (
            <div
              role="status"
              className="mb-5 flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isMfaRequired ? (
              <>
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                    Work Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="physician@hospital.org"
                      className="w-full text-xs rounded-md border border-slate-300 pl-9 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:border-[#0891B2]"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <a
                      href="#forgot-password"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Please contact your hospital IT administrator to reset credentials.');
                      }}
                      className="text-xs text-[#0891B2] hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full text-xs rounded-md border border-slate-300 pl-9 pr-9 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:border-[#0891B2]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
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
                    className="h-4 w-4 rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-600 cursor-pointer">
                    Remember this workstation for 30 days
                  </label>
                </div>
              </>
            ) : (
              /* Two-Factor Authentication Step */
              <div className="space-y-4">
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-900">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-[#0891B2]" aria-hidden="true" />
                    <span>Two-Factor Authentication Required</span>
                  </div>
                  Enter the 6-digit verification code from your authenticator app.
                </div>

                <div>
                  <label htmlFor="mfa-code" className="block text-xs font-semibold text-slate-700 mb-1">
                    Security Passcode <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-4 h-4 absolute left-3 text-slate-400 pointer-events-none" aria-hidden="true" />
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
                      className="w-full text-center tracking-widest text-lg font-mono rounded-md border border-slate-300 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0891B2]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMfaRequired(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 underline block text-center w-full"
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
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Quick Demo Access
              </p>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                Password: password123
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-between p-2.5 bg-cyan-50/70 border border-cyan-200 rounded-lg transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-[#0891B2] flex items-center gap-1.5">
                    <span>Priya (Admin)</span>
                    <span className="text-[10px] font-normal text-slate-500 font-mono">password123</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono truncate">priya.s@vedichealth.org</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => applyCredentials('priya.s@vedichealth.org', 'password123')}
                    className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickLogin('priya.s@vedichealth.org', 'password123')}
                    className="px-2.5 py-1 text-[11px] text-white bg-[#0891B2] hover:bg-[#0e7490] rounded font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    1-Click Sign In
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    <span>Doctor Role</span>
                    <span className="text-[10px] font-normal text-slate-400 font-mono">password123</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">doctor@demo.com</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => applyCredentials('doctor@demo.com', 'password123')}
                    className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickLogin('doctor@demo.com', 'password123')}
                    className="px-2.5 py-1 text-[11px] text-white bg-slate-700 hover:bg-slate-800 rounded font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    1-Click Sign In
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    <span>Super Admin</span>
                    <span className="text-[10px] font-normal text-slate-400 font-mono">password123</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">admin@enterprise-hms.com</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    type="button"
                    onClick={() => applyCredentials('admin@enterprise-hms.com', 'password123')}
                    className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded hover:bg-slate-50 font-medium transition-colors cursor-pointer"
                  >
                    Fill
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleQuickLogin('admin@enterprise-hms.com', 'password123')}
                    className="px-2.5 py-1 text-[11px] text-white bg-slate-700 hover:bg-slate-800 rounded font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    1-Click Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance & Security Audit Footnote */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" aria-hidden="true" />
              <span>Protected Health Information (PHI) Secure System</span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              Authorized clinical personnel only. All access, lookups, and modifications are
              cryptographically logged and audited for compliance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
