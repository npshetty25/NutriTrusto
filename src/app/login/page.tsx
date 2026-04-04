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

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1222]/90 p-6 backdrop-blur">
        {emailSent ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-safe/10 border border-safe/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight mb-2 text-white">Check your inbox</h2>
            <p className="text-sm text-foreground/50 mb-6 leading-relaxed">
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click the link in the email to activate your account, then sign in here.
            </p>
            <button
              type="button"
              onClick={() => {
                setEmailSent(false);
                setMode("signin");
                setError(null);
              }}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:opacity-90 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${mode === "signin" ? "bg-white text-black shadow" : "text-white/60 hover:text-white"}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
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
          </>
        )}
      </div>
    </div>
  );
}
