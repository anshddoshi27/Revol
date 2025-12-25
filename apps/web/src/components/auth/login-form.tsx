"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Phone, Eye, EyeOff, ArrowRight, ShieldCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelperText } from "@/components/ui/helper-text";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createClientClient } from "@/lib/supabase-client";
import { loginSchema, type LoginFormValues } from "@/lib/validators";

const passwordHint = "Use 8+ characters and include at least one special character.";
const DEV_EMAIL = "owner@tithi.dev";
const DEV_PASSWORD = "Ready4Tithi!";

export function LoginForm() {
  const router = useRouter();
  const toast = useToast();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mode: "email",
      email: "",
      phone: "",
      password: ""
    },
    mode: "onChange",
    reValidateMode: "onChange"
  });

  const mode = form.watch("mode");
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isSubmitting, isSubmitted }
  } = form;

  const errorMessages = useMemo(() => {
    return Object.values(errors).map((error) => error.message).filter(Boolean);
  }, [errors]);

  const toggleMode = (nextMode: "email" | "phone") => {
    form.setValue("mode", nextMode, { shouldValidate: true });
    if (nextMode === "email") {
      form.setFocus("email");
    } else {
      form.setFocus("phone");
    }
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      const supabase = createClientClient();
      
      // Validate email is provided for email mode
      if (values.mode === "email" && !values.email) {
        toast.pushToast({
          title: "Login failed",
          description: "Email is required",
          intent: "error"
        });
        setIsLoading(false);
        return;
      }

      // Authenticate with Supabase
      const email = values.mode === "email" ? values.email! : "";
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: values.password,
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        console.error('Error details:', {
          message: authError.message,
          status: authError.status,
          name: authError.name
        });
        
        // Provide more helpful error messages
        let errorMessage = authError.message || "Invalid email or password";
        if (authError.message?.includes('Invalid login credentials')) {
          errorMessage = "Invalid email or password. If you just ran the seed script, the password might need to be reset manually in Supabase Dashboard.";
    }

        toast.pushToast({
          title: "Login failed",
          description: errorMessage,
          intent: "error"
        });
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        toast.pushToast({
          title: "Login failed",
          description: "Authentication failed. Please try again.",
          intent: "error"
        });
        setIsLoading(false);
        return;
      }

      // Fetch user's business from database - check if it's already launched
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('id, subdomain, name, subscription_status, stripe_connect_account_id, timezone, support_email')
        .eq('user_id', authData.user.id)
        .is('deleted_at', null)
        .maybeSingle();

      console.log('Business query result:', { business, businessError, userId: authData.user.id });

      if (businessError) {
        console.error('Error fetching business:', businessError);
        // Don't fail login if business query fails - user might not have completed onboarding
        // Just redirect to onboarding
        toast.pushToast({
          title: "Login successful",
          description: "Welcome! Let's set up your business.",
          intent: "success"
        });
        router.push("/onboarding?new=true");
        setIsLoading(false);
        return;
      }

      // Check if business is already launched
      // A business is considered "launched" if it has:
      // - subscription_status set (trial, active, paused, canceled) - this indicates go-live step was completed
      // - Essential fields (name, subdomain, timezone, support_email)
      // Note: stripe_connect_account_id is optional - business can be launched without Stripe Connect
      const isLaunched = business && 
        business.subscription_status && 
        business.subscription_status !== null &&
        business.name && 
        business.name.trim().length > 0 &&
        business.subdomain && 
        !business.subdomain.startsWith('temp-') &&
        business.timezone &&
        business.support_email;

      toast.pushToast({
        title: "Login successful",
        description: business 
          ? (isLaunched 
              ? `Welcome back to ${business.name}!`
              : `Welcome back! Let's finish setting up ${business.name}.`)
          : "Welcome! Let's set up your business.",
        intent: "success"
      });

      // Redirect based on whether business exists and is launched
      if (business && isLaunched) {
        // Business is already launched - go directly to admin (onboarding is locked)
        const redirectPath = `/app/b/${business.id}`;
        console.log('[login] Business is already launched - redirecting to admin:', redirectPath);
        router.push(redirectPath);
        // Force navigation if router.push doesn't work
        setTimeout(() => {
          if (window.location.pathname === '/login') {
            console.warn('Router.push failed, using window.location');
            window.location.href = redirectPath;
          }
        }, 500);
      } else if (business) {
        // Business exists but not launched - continue onboarding
        console.log('[login] Business exists but not launched - redirecting to onboarding');
        router.push("/onboarding");
      } else {
        // No business - start fresh onboarding
        console.log('[login] No business found - starting fresh onboarding');
        router.push("/onboarding?new=true");
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.pushToast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        intent: "error"
    });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setIsLoading(true);
    try {
      const supabase = createClientClient();
      
      // Try to login with dev account
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      });

      if (authError || !authData.user) {
        toast.pushToast({
          title: "Dev login failed",
          description: "Dev account not found. Use the seed script to create it.",
          intent: "error"
        });
        setIsLoading(false);
        return;
      }

      // Fetch business
      const { data: business } = await supabase
        .from('businesses')
        .select('id, subdomain, name')
        .eq('user_id', authData.user.id)
        .is('deleted_at', null)
        .maybeSingle();

    toast.pushToast({
      title: "Dev session ready",
        description: business 
          ? `Loaded ${business.name} with seed data.`
          : "Dev account loaded. Complete onboarding to create business.",
      intent: "info"
    });

      if (business) {
        router.push(`/app/b/${business.id}`);
      } else {
        router.push("/onboarding");
      }
    } catch (error) {
      console.error('Dev login error:', error);
      toast.pushToast({
        title: "Dev login failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        intent: "error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-panel relative w-full max-w-lg rounded-3xl border border-white/10 p-10 shadow-glow-blue">
      <div className="mb-8">
        <Badge intent="info" className="mb-4 w-fit">
          Owner Access
        </Badge>
        <h1 className="font-display text-4xl tracking-tight text-white">
          Welcome back to Tithi
        </h1>
        <p className="mt-3 text-base text-white/60">
          Log in to manage your businesses, update onboarding steps, and control how payments
          are captured.
        </p>
      </div>

      {isSubmitted && errorMessages.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          <p className="font-semibold">We need a quick fix:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-6"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        aria-live="polite"
      >
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
            Sign in with
          </span>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === "email"
                  ? "border-white/60 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white/80"
              }`}
              onClick={() => toggleMode("email")}
              aria-pressed={mode === "email"}
            >
              <div className="flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span>Email</span>
              </div>
            </button>
            <button
              type="button"
              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === "phone"
                  ? "border-white/60 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:text-white/80"
              }`}
              onClick={() => toggleMode("phone")}
              aria-pressed={mode === "phone"}
            >
              <div className="flex items-center justify-center gap-2">
                <Phone className="h-4 w-4" aria-hidden="true" />
                <span>Phone</span>
              </div>
            </button>
          </div>
        </div>

        {mode === "email" ? (
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@business.com"
                  inputMode="email"
                  autoComplete="email"
                  error={errors.email?.message}
                  aria-describedby={
                    [
                      "login-email-helper",
                      errors.email?.message ? "login-email-error" : undefined
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  {...field}
                />
                <HelperText id="login-email-helper" className="mt-2">
                  Use the owner email you signed up with.
                </HelperText>
                {errors.email?.message ? (
                  <HelperText
                    id="login-email-error"
                    intent="error"
                    role="alert"
                    className="mt-1"
                  >
                    {errors.email.message}
                  </HelperText>
                ) : null}
              </div>
            )}
          />
        ) : (
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <div>
                <label
                  htmlFor="login-phone"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Phone number
                </label>
                <Input
                  id="login-phone"
                  type="tel"
                  placeholder="+1 555 010 2030"
                  inputMode="tel"
                  autoComplete="tel"
                  error={errors.phone?.message}
                  aria-describedby={
                    [
                      "login-phone-helper",
                      errors.phone?.message ? "login-phone-error" : undefined
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  {...field}
                />
                <HelperText id="login-phone-helper" className="mt-2">
                  Include your country code for best results.
                </HelperText>
                {errors.phone?.message ? (
                  <HelperText
                    id="login-phone-error"
                    intent="error"
                    role="alert"
                    className="mt-1"
                  >
                    {errors.phone.message}
                  </HelperText>
                ) : null}
              </div>
            )}
          />
        )}

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <div>
              <label
                htmlFor="login-password"
                className="mb-2 flex items-center justify-between text-sm font-medium text-white/80"
              >
                <span>Password</span>
                <span className="text-xs text-white/40">Owner access only</span>
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={isPasswordVisible ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  error={errors.password?.message}
                  aria-describedby={
                    [
                      "login-password-hint",
                      errors.password?.message ? "login-password-error" : undefined
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  {...field}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-white/40 transition hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  onClick={() => setIsPasswordVisible((prev) => !prev)}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                >
                  {isPasswordVisible ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <HelperText id="login-password-hint" className="mt-2">
                {passwordHint}
              </HelperText>
              {errors.password?.message ? (
                <HelperText
                  id="login-password-error"
                  intent="error"
                  role="alert"
                  className="mt-1"
                >
                  {errors.password.message}
                </HelperText>
              ) : null}
            </div>
          )}
        />

        <div className="flex items-center justify-between text-sm text-white/50">
          <span className="cursor-not-allowed rounded-full px-3 py-1 text-white/30">
            Forgot password? (Coming soon)
          </span>
          <button
            type="button"
            onClick={handleDevLogin}
            className="rounded-full px-3 py-1 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:text-primary/80"
          >
            Dev Login
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting || isLoading}
            disabled={!isValid || isSubmitting || isLoading}
            className="w-full text-base"
          >
            <span className="flex items-center justify-center">
              <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
              Login
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
              Sign in with Google (coming soon)
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}


