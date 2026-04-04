"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const router = useRouter();

  // Already signed in — go to dashboard
  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const [dietaryPreference, setDietaryPreference] = useState("None");

  const DIETARY_OPTIONS = [
    { id: "Veg", label: "Veg", emoji: "🥗" },
    { id: "Non-Veg", label: "Non-Veg", emoji: "🍗" },
    { id: "Eggtarian", label: "Eggtarian", emoji: "🥚" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let result;
    if (mode === "signin") {
      result = await signIn(email, password);
    } else {
      if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
      
      // Complete sign up immediately
      result = await signUp(name.trim(), email, password, dietaryPreference);
    }

    setLoading(false);
    if (result.error) {
      // Show a friendlier message for common Supabase errors
      if (result.error.toLowerCase().includes("email not confirmed")) {
        setError("Please confirm your email first. Check your inbox for a confirmation link.");
      } else {
        setError(result.error);
      }
    } else if (mode === "signup") {
      // Supabase requires email confirmation — show success message
      setEmailSent(true);
    } else {
      router.push("/"); // Sign in went straight through — go to dashboard
    }

  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060A14] text-foreground px-4 py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-8 h-64 w-64 rounded-full bg-blue-500/14 blur-3xl" />
        <div className="absolute -bottom-28 -right-10 h-72 w-72 rounded-full bg-indigo-500/14 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0B1222]/88 backdrop-blur-xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)] p-6 sm:p-7">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative mb-4 w-full flex justify-center">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-38 w-38 rounded-full border border-blue-300/20 animate-spin [animation-duration:24s]" />
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 h-33 w-33 rounded-full border border-indigo-300/20 animate-spin [animation-duration:14s] [animation-direction:reverse]" />
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-blue-300 shadow-[0_0_16px_rgba(147,197,253,0.8)]" />
            <div className="relative z-10 p-0">
              <img
                src="/logo.svg"
                alt="Nutri-Trust logo"
                className="w-36 h-36 object-contain drop-shadow-[0_8px_20px_rgba(96,165,250,0.35)]"
              />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Nutri-Trust</h1>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50 mt-1">Smart Pantry Intelligence</p>
        </div>

      {/* Email confirmation sent screen */}
      {emailSent ? (
        <div className="w-full text-center">
          <div className="w-14 h-14 bg-safe/10 border border-safe/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <span className="text-2xl">✉️</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2 text-white">Check your inbox</h2>
          <p className="text-sm text-foreground/50 mb-6 leading-relaxed">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click the link in the email to activate your account, then sign in here.
          </p>
          <button
            onClick={() => { setEmailSent(false); setMode("signin"); setPassword(""); }}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to Sign In
          </button>
        </div>
      ) : (

      <div className="w-full">
        <div className="mb-7">
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-white/55">
            {mode === "signin" ? "Sign in to sync your household pantry." : "Join Nutri-Trust and start reducing food waste."}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
          <button
            type="button"
            onClick={() => { setMode("signin"); setError(null); }}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${mode === "signin" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${mode === "signup" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          <div className="space-y-4 animate-in slide-in-from-left-2 fade-in duration-300">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Full Name</label>
                  <input
                    type="text"
                    placeholder="Alex Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-300/50 focus:ring-1 focus:ring-blue-300/30 transition-all text-white placeholder:text-white/35"
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Dietary Preference</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIETARY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDietaryPreference(opt.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs transition-all ${
                          dietaryPreference === opt.id
                            ? "border-blue-300/50 bg-blue-400/10 text-white font-semibold"
                            : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                        }`}
                      >
                        <span className="text-xl">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Email Address</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-300/50 focus:ring-1 focus:ring-blue-300/30 transition-all text-white placeholder:text-white/35"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-300/50 focus:ring-1 focus:ring-blue-300/30 transition-all text-white placeholder:text-white/35 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </div>



        </form>

        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
          <div className="relative flex justify-center">
            <span className="bg-[#0B1222] px-3 text-[10px] uppercase font-semibold tracking-widest text-white/35">Or continue with</span>
          </div>
        </div>

        <button type="button" className="w-full bg-white/5 border border-white/10 text-white text-sm font-semibold py-3 rounded-xl hover:bg-white/10 transition-colors sleek-shadow flex items-center justify-center gap-2.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>
      )} {/* end emailSent ternary */}
      </div>
    </div>
  );
}
