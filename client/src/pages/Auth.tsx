import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  Mail,
  Building,
  ArrowRight,
  User,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  ArrowLeft,
  IndianRupee,
  Receipt,
  CheckCircle2,
  Sparkles,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/custom/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/custom/Label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { BRAND_NAME } from "@/lib/brand";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Auth = () => {
  const { t } = useTranslation("login");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Forgot Password state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to send verification code");
      }

      toast.success("Verification code sent to your email! Please check your inbox.");
      setForgotStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      toast.error("Please enter the 6-digit verification code.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsForgotLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
          newPassword: forgotNewPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to reset password");
      }

      toast.success("Password reset successfully! Please sign in with your new password.");
      setEmail(forgotEmail.trim());
      setPassword("");
      setIsForgotModalOpen(false);
      setForgotStep(1);
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!isLogin && password !== confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isLogin
        ? `${import.meta.env.VITE_API_BASE_URL}/login`
        : `${import.meta.env.VITE_API_BASE_URL}/signup`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fullName,
          email,
          password,
          role: "EMPLOYEE",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Authentication failed");
      }

      localStorage.setItem("token", data.token);
      if (!data.user) {
        throw new Error("Authentication response did not include user details");
      }
      localStorage.setItem(
        "user",
        JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role,
        })
      );
      toast.success(isLogin ? "Welcome back!" : "Account created successfully!");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background text-foreground antialiased selection:bg-primary/30">
      {/* Left Column: Enterprise Hero & Branding (Visible on lg+) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 bg-gradient-to-br from-slate-950 via-indigo-950/70 to-slate-950 border-r border-border/50 overflow-hidden">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Logo & Title */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
            <IndianRupee className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {BRAND_NAME}
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Enterprise Spend Management Platform</p>
          </div>
        </div>

        {/* Center: Hero Value Proposition */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built for SVC Infosystems Operations</span>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              Simplify spend.{" "}
              <span className="bg-gradient-to-r from-primary via-indigo-300 to-accent bg-clip-text text-transparent">
                Amplify growth.
              </span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              Eliminate paper vouchers, manual spreadsheets, and approval delays. Submit, approve, and reimburse work and site-visit expenses in one unified workspace.
            </p>
          </div>

          {/* Key Capabilities */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-sm text-foreground/90">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Automated 1-Up Manager Approvals & Signing Authority Limits</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground/90">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>16 Enterprise Expense Categories with Bill & Receipt Attachments</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground/90">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Finance Payout Settlements with Bank UTR Reference Tracking</span>
            </div>
          </div>

          {/* Testimonial Quote */}
          <div className="p-4 rounded-xl bg-card/60 border border-border/80 backdrop-blur-md shadow-sm">
            <p className="text-sm text-foreground/90 italic">
              "Streamlining operational expense reimbursements across all project site visits with complete audit compliance."
            </p>
            <div className="flex items-center gap-2 mt-2.5 text-xs font-semibold text-primary">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SVC Infosystems Finance & Operations</span>
            </div>
          </div>
        </div>

        {/* Bottom: Legal & Support */}
        <div className="relative z-10 flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/40">
          <span>&copy; {new Date().getFullYear()} SVC Infosystems. All rights reserved.</span>
          <a href="mailto:info@svcinfosys.in" className="hover:text-foreground transition-colors">
            Support: info@svcinfosys.in
          </a>
        </div>
      </div>

      {/* Right Column: Form Container */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16 overflow-y-auto">
        <motion.div
          className="w-full max-w-[440px] space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {/* Mobile-only Branding Header */}
          <div className="lg:hidden text-center space-y-2 mb-6">
            <div className="inline-flex h-12 w-12 rounded-xl bg-primary/20 border border-primary/30 items-center justify-center mx-auto shadow-md">
              <IndianRupee className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{BRAND_NAME}</h1>
            <p className="text-xs text-muted-foreground">Enterprise Spend Management Platform</p>
          </div>

          {/* Card Container */}
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/20 space-y-6">
            {/* Header with Title & Description */}
            <div className="space-y-1.5 text-left">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {isLogin ? "Welcome back" : "Create an account"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isLogin
                  ? `Sign in to access your ${BRAND_NAME} workspace`
                  : `Register to submit and track your work expense claims`}
              </p>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-muted/60 border border-border/60">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={cn(
                  "py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
                  isLogin
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={cn(
                  "py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer",
                  !isLogin
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Sign Up
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name (Sign Up only) */}
              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5"
                  >
                    <Label htmlFor="fullName" className="text-xs font-semibold text-foreground">
                      Full Name
                    </Label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="pl-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                        style={{ paddingLeft: "2.75rem" }}
                        required={!isLogin}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                  Email Address
                </Label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@svcinfosys.in"
                    className="pl-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                    style={{ paddingLeft: "2.75rem" }}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                    Password
                  </Label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotStep(1);
                        setIsForgotModalOpen(true);
                      }}
                      className="text-xs text-primary font-medium hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer z-10 p-1 flex items-center justify-center"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!isLogin && (
                  <p className="text-[11px] text-muted-foreground">Must be at least 8 characters long.</p>
                )}
              </div>

              {/* Confirm Password (Sign Up only) */}
              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-1.5"
                  >
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground">
                      Confirm Password
                    </Label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                        style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                        required={!isLogin}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer z-10 p-1 flex items-center justify-center"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sign Up Role Notice (Replaces fake role dropdown) */}
              {!isLogin && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground/80 leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    New signups receive standard <strong>Employee</strong> access. Manager and Finance permissions are granted by your system administrator.
                  </span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full py-2.5 h-11 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      {isLogin ? "Signing in..." : "Creating account..."}
                    </span>
                  ) : (
                    <>
                      <span>{isLogin ? "Sign In to SpendX" : "Create Account"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>

          {/* Footer Support Info */}
          <div className="text-center text-xs text-muted-foreground">
            Need help? Contact{" "}
            <a
              href="mailto:info@svcinfosys.in"
              className="text-primary hover:underline font-medium"
            >
              info@svcinfosys.in
            </a>
          </div>
        </motion.div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog
        open={isForgotModalOpen}
        onOpenChange={(open) => {
          setIsForgotModalOpen(open);
          if (!open) {
            setForgotStep(1);
            setForgotOtp("");
            setForgotNewPassword("");
            setForgotConfirmPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card border border-border p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {forgotStep === 1
                ? "Enter your registered email address. We'll send you a 6-digit verification code."
                : `Enter the 6-digit verification code sent to ${forgotEmail} and set your new password.`}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgotEmail" className="text-xs font-semibold text-foreground">
                  Registered Email Address
                </Label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    id="forgotEmail"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="user@svcinfosys.in"
                    className="pl-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                    style={{ paddingLeft: "2.75rem" }}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
                  disabled={isForgotLoading}
                >
                  {isForgotLoading ? "Sending Code..." : "Send Verification Code"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="forgotOtp" className="text-xs font-semibold text-foreground">
                  6-Digit Verification Code
                </Label>
                <Input
                  id="forgotOtp"
                  type="text"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="font-mono text-center tracking-widest text-xl font-bold h-11 rounded-xl bg-slate-900 border-slate-700 text-primary focus:bg-slate-900"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="forgotNewPassword" className="text-xs font-semibold text-foreground">
                  New Password
                </Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    id="forgotNewPassword"
                    type={showForgotNewPassword ? "text" : "password"}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer z-10 p-1 flex items-center justify-center"
                    aria-label={showForgotNewPassword ? "Hide password" : "Show password"}
                  >
                    {showForgotNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Must be at least 8 characters long.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="forgotConfirmPassword" className="text-xs font-semibold text-foreground">
                  Confirm New Password
                </Label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                  <Input
                    id="forgotConfirmPassword"
                    type={showForgotNewPassword ? "text" : "password"}
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11 pr-11 h-11 rounded-xl bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:bg-slate-900 focus:border-primary text-sm"
                    style={{ paddingLeft: "2.75rem", paddingRight: "2.75rem" }}
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setForgotStep(1)}
                  className="gap-1 text-xs cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change Email
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl"
                    disabled={isForgotLoading}
                  >
                    {isForgotLoading ? "Resetting..." : "Reset Password"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
