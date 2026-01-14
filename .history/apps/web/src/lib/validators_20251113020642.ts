import { z } from "zod";

const passwordSpecialCharRegex = /[^A-Za-z0-9]/;
const phoneRegex = /^\+?[0-9 ()-]{10,}$/;

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (value) => passwordSpecialCharRegex.test(value),
    "Include at least one special character."
  );

export const emailSchema = z
  .string()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const phoneSchema = z
  .string()
  .min(1, "Phone number is required.")
  .regex(phoneRegex, "Enter a valid phone number with country code if needed.");

export const loginSchema = z
  .object({
    mode: z.enum(["email", "phone"]),
    email: z.string().optional(),
    phone: z.string().optional(),
    password: passwordSchema
  })
  .superRefine((data, ctx) => {
    if (data.mode === "email") {
      if (!data.email) {
        ctx.addIssue({
          path: ["email"],
          code: z.ZodIssueCode.custom,
          message: "Email is required."
        });
      } else {
        const result = emailSchema.safeParse(data.email);
        if (!result.success) {
          ctx.addIssue({
            path: ["email"],
            code: z.ZodIssueCode.custom,
            message: result.error.errors[0]?.message ?? "Invalid email."
          });
        }
      }
    }

    if (data.mode === "phone") {
      if (!data.phone) {
        ctx.addIssue({
          path: ["phone"],
          code: z.ZodIssueCode.custom,
          message: "Phone number is required."
        });
      } else {
        const result = phoneSchema.safeParse(data.phone);
        if (!result.success) {
          ctx.addIssue({
            path: ["phone"],
            code: z.ZodIssueCode.custom,
            message: result.error.errors[0]?.message ?? "Invalid phone number."
          });
        }
      }
    }
  });

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Enter your full name.")
      .refine((value) => value.trim().split(" ").length >= 2, {
        message: "Include both first and last name."
      }),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        code: z.ZodIssueCode.custom,
        message: "Passwords must match."
      });
    }
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;




