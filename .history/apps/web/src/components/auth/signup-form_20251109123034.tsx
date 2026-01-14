"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, UserPlus, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useFakeSession } from "@/lib/fake-session";
import {
  signupSchema,
  type SignupFormValues
} from "@/lib/validators";

const passwordHint = "Use 8+ characters with at least one special character for security.";

export function SignupForm() {
  const router = useRouter();
  const toast = useToast();
  const session = useFakeSession();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    watch
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: ""
    }
  });

  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");

  const onSubmit = async (values: SignupFormValues) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    session.login({
      id: "owner-new",
      name: values.fullName,
      email: values.email,
      phone: values.phone
    });
    toast.pushToast({
      title: "Account created",
      description:
        "Let’s walk through onboarding to configure your business before accepting bookings.",
      intent: "success"
    });
    router.push("/onboarding");
  };

  return (
    <div className="glass-panel relative w-full max-w-2xl rounded-3xl border border-white/10 p-10 shadow-glow-blue">
      <div className="mb-8 space-y-3">
        <Badge intent="info" className="w-fit">
          Step 0 · Account setup
        </Badge>
        <h1 className="font-display text-4xl text-white">
          Create your Tithi owner account
        </h1>
        <p className="text-base text-white/60">
          This sets up your admin access. You’ll configure your business, services, and
          payment settings next. No charges happen until onboarding is complete.
        </p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid grid-cols-1 gap-6"
        aria-live="polite"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="signup-full-name"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Full name
            </label>
            <Input
              id="signup-full-name"
              placeholder="Avery Quinn"
              autoComplete="name"
              error={errors.fullName?.message}
              aria-describedby={
                [
                  "signup-full-name-helper",
                  errors.fullName?.message ? "signup-full-name-error" : undefined
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              {...register("fullName")}
            />
            <HelperText id="signup-full-name-helper" className="mt-2">
              Only the owner has access—include both first and last name.
            </HelperText>
            {errors.fullName?.message ? (
              <HelperText
                id="signup-full-name-error"
                intent="error"
                role="alert"
                className="mt-1"
              >
                {errors.fullName.message}
              </HelperText>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="signup-email"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Email
            </label>
            <Input
              id="signup-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@business.com"
              error={errors.email?.message}
              aria-describedby={
                [
                  "signup-email-helper",
                  errors.email?.message ? "signup-email-error" : undefined
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              {...register("email")}
            />
            <HelperText id="signup-email-helper" className="mt-2">
              Use the email you’ll sign in with for admin access.
            </HelperText>
            {errors.email?.message ? (
              <HelperText
                id="signup-email-error"
                intent="error"
                role="alert"
                className="mt-1"
              >
                {errors.email.message}
              </HelperText>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="signup-phone"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Phone number
            </label>
            <Input
              id="signup-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1 555 010 2030"
              error={errors.phone?.message}
              aria-describedby={
                [
                  "signup-phone-helper",
                  errors.phone?.message ? "signup-phone-error" : undefined
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              {...register("phone")}
            />
            <HelperText id="signup-phone-helper" className="mt-2">
              We’ll send critical booking alerts here.
            </HelperText>
            {errors.phone?.message ? (
              <HelperText
                id="signup-phone-error"
                intent="error"
                role="alert"
                className="mt-1"
              >
                {errors.phone.message}
              </HelperText>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="signup-password"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.password?.message}
                aria-describedby={
                  [
                    "signup-password-helper",
                    errors.password?.message ? "signup-password-error" : undefined
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                {...register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-3 flex items-center text-white/40 transition hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <HelperText id="signup-password-helper" className="mt-2">
              {passwordHint}
            </HelperText>
            {errors.password?.message ? (
              <HelperText
                id="signup-password-error"
                intent="error"
                role="alert"
                className="mt-1"
              >
                {errors.password.message}
              </HelperText>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="signup-confirm-password"
              className="mb-2 block text-sm font-medium text-white/80"
            >
              Confirm password
            </label>
            <div className="relative">
              <Input
                id="signup-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                aria-describedby={
                  [
                    "signup-confirm-password-helper",
                    errors.confirmPassword?.message
                      ? "signup-confirm-password-error"
                      : undefined,
                    passwordValue && confirmPasswordValue && !errors.confirmPassword
                      ? "signup-password-match"
                      : undefined
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                {...register("confirmPassword")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-3 flex items-center text-white/40 transition hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <HelperText id="signup-confirm-password-helper" className="mt-2">
              Must match the password you just entered.
            </HelperText>
            {errors.confirmPassword?.message ? (
              <HelperText
                id="signup-confirm-password-error"
                intent="error"
                role="alert"
                className="mt-1"
              >
                {errors.confirmPassword.message}
              </HelperText>
            ) : null}
            {passwordValue &&
            confirmPasswordValue &&
            !errors.confirmPassword ? (
              <HelperText
                id="signup-password-match"
                intent="success"
                className="mt-1 text-emerald-200"
              >
                Passwords match.
              </HelperText>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <Button
            type="submit"
            size="lg"
            className="w-full justify-center text-base"
            isLoading={isSubmitting}
            disabled={!isValid || isSubmitting}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create account
            </span>
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled
            className="w-full justify-center border-white/15 bg-white/10 text-white/50"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Sign up with Google (coming soon)
            </span>
          </Button>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between text-sm text-white/60">
        <span>By continuing you agree to the Tithi Terms & Privacy.</span>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:text-primary/80"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}


