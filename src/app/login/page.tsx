"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig, type Variants } from "framer-motion";
import { useAuth } from "@/context/auth-context";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 26 },
  },
};

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

  const inputClass =
    "neu-field w-full rounded-xl px-4 py-3.5 text-base text-foreground placeholder:text-foreground/35";

  return (
    <MotionConfig reducedMotion="user">
      {/* Same --background, same neumorphic tokens as the dashboard. This
          screen used to sit on its own #050A16 navy with a cyan gradient,
          which made signing in and using the app feel like two products. */}
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground px-4 py-8">
        {/* Drifting ambient blobs — pure decoration, non-interactive */}
        <div className="pointer-events-none absolute inset-0">
          <div className="animate-blob absolute -top-24 -left-8 h-72 w-72 rounded-full bg-brand/12 blur-3xl" />
          <div className="animate-blob absolute -bottom-28 -right-10 h-80 w-80 rounded-full bg-safe/12 blur-3xl [animation-delay:-6s]" />
          <div className="animate-blob absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/8 blur-3xl [animation-delay:-12s]" />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="neu-raised relative z-10 w-full max-w-lg rounded-[2rem] p-8"
        >
          <motion.div variants={rise} className="flex flex-col items-center text-center mb-8">
            <div className="animate-float neu-raised relative mb-4 rounded-3xl bg-white p-4">
              <Image
                src="/logo.svg"
                alt="Nutri-Trust"
                width={360}
                height={280}
                priority
                className="h-32 w-auto max-w-[320px]"
              />
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              Nutri-Trust
            </h1>
            <p className="mt-1 text-sm text-foreground/60">Your smart pantry companion</p>
          </motion.div>

          <AnimatePresence mode="wait" initial={false}>
            {emailSent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -25 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                  className="neu-raised-sm w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                >
                  <span className="text-2xl">✉️</span>
                </motion.div>
                <h2 className="text-xl font-bold tracking-tight mb-2 text-foreground">Check your inbox</h2>
                <p className="text-sm text-foreground/60 mb-6 leading-relaxed">
                  We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click the link in the email to activate your account, then sign in here.
                </p>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setEmailSent(false);
                    setMode("signin");
                    setError(null);
                  }}
                  className="neu-pressable w-full text-foreground font-bold py-3 rounded-xl"
                >
                  Back to Sign In
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
              >
                {/* Segmented control — the active pill is a single shared
                    element that slides between tabs via layoutId. */}
                <motion.div variants={rise} className="neu-inset flex items-center rounded-2xl p-1.5 mb-7">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMode(m);
                        setError(null);
                      }}
                      className={`relative flex-1 text-base font-semibold py-3 rounded-xl transition-colors duration-300 ${
                        mode === m ? "text-primary-foreground" : "text-foreground/60 hover:text-foreground"
                      }`}
                    >
                      {mode === m && (
                        <motion.span
                          layoutId="authPill"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-foreground"
                        />
                      )}
                      <span className="relative z-10">{m === "signin" ? "Sign In" : "Sign Up"}</span>
                    </button>
                  ))}
                </motion.div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <motion.div
                          animate={{ x: [0, -7, 7, -4, 4, 0] }}
                          transition={{ duration: 0.4 }}
                          className="text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-xl px-4 py-3"
                        >
                          {error}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    <AnimatePresence initial={false}>
                      {mode === "signup" && (
                        <motion.div
                          key="signup-fields"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-4 pb-1">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Full Name</label>
                              <input
                                type="text"
                                placeholder="Alex Smith"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className={inputClass}
                              />
                            </div>

                            <div className="space-y-3 pt-2">
                              <label className="text-[11px] font-semibold uppercase tracking-widest text-foreground/60">Dietary Preference</label>
                              <div className="grid grid-cols-3 gap-2.5">
                                {DIETARY_OPTIONS.map((opt) => {
                                  const selected = dietaryPreference === opt.id;
                                  return (
                                    <motion.button
                                      key={opt.id}
                                      type="button"
                                      whileTap={{ scale: 0.94 }}
                                      onClick={() => setDietaryPreference(opt.id)}
                                      className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-xs transition-all duration-300 ${
                                        selected
                                          ? "neu-inset text-foreground font-semibold"
                                          : "neu-raised-sm text-foreground/70 hover:text-foreground"
                                      }`}
                                    >
                                      <motion.span
                                        className="text-xl"
                                        animate={selected ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                                        transition={{ duration: 0.4 }}
                                      >
                                        {opt.emoji}
                                      </motion.span>
                                      {opt.label}
                                      {selected && (
                                        <motion.span
                                          layoutId="dietGlow"
                                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                          className="absolute inset-0 rounded-xl ring-2 ring-brand"
                                        />
                                      )}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                      <label className="text-[12px] font-semibold uppercase tracking-widest text-foreground/60">Email Address</label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={inputClass}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[12px] font-semibold uppercase tracking-widest text-foreground/60">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "Hide password" : "Show password"}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground transition-colors p-1"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={loading}
                      whileHover={{ scale: loading ? 1 : 1.02 }}
                      whileTap={{ scale: loading ? 1 : 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      className="group w-full bg-foreground text-background font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-5 disabled:opacity-60 shadow-lg shadow-foreground/15 hover:shadow-xl hover:shadow-foreground/25 transition-shadow duration-300"
                    >
                      {loading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                      )}
                      {mode === "signin" ? "Sign In" : "Create Account"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
