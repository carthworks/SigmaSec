"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Loader2, Key, Mail, User, Building } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  orgName: z.string().min(2, "Organization name must be at least 2 characters."),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  confirmPassword: z.string().min(8, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      orgName: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SignupFormValues) {
    setIsLoading(true);
    
    try {
      // 1. Submit signup request to backend
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          full_name: values.fullName,
          org_name: values.orgName,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Registration failed");
      }

      toast.success("Account Created Successfully", {
        description: "Setting up your workspace and signing you in...",
      });

      // 2. Automatically log the user in
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        rememberMe: "false",
        redirect: false,
      });

      if (result?.error) {
        toast.warning("Automatic Sign In Failed", {
          description: "Please sign in manually with your credentials.",
        });
        router.push("/login");
      } else {
        toast.success("Welcome!", {
          description: "Redirecting to your security dashboard...",
        });
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error: any) {
      toast.error("Registration Error", {
        description: error.message || "An unexpected error occurred during signup.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Trigger popups for validation errors
  const onError = (errors: any) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      const firstError = errors[errorKeys[0]];
      if (firstError?.message) {
        toast.warning("Validation Warning", {
          description: firstError.message,
        });
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border border-border/80 bg-card/70 backdrop-blur-md shadow-xl hover:shadow-2xl hover:border-primary/20 transition-all duration-300 transform hover:-translate-y-0.5">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 animate-pulse">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Create Account
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Register your organization to start monitoring your security posture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-wide text-foreground/80">
                      Full Name
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
                        <Input 
                          placeholder="John Doe" 
                          type="text" 
                          disabled={isLoading}
                          className="pl-9 bg-background/50 border-border/80 focus:bg-background/80"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-wide text-foreground/80">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
                        <Input 
                          placeholder="name@company.com" 
                          type="email" 
                          autoCapitalize="none"
                          autoComplete="email"
                          autoCorrect="off"
                          disabled={isLoading}
                          className="pl-9 bg-background/50 border-border/80 focus:bg-background/80"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-wide text-foreground/80">
                      Organization Name
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
                        <Input 
                          placeholder="Acme Corp" 
                          type="text" 
                          disabled={isLoading}
                          className="pl-9 bg-background/50 border-border/80 focus:bg-background/80"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-wide text-foreground/80">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
                        <Input 
                          placeholder="••••••••" 
                          type="password" 
                          disabled={isLoading}
                          className="pl-9 bg-background/50 border-border/80 focus:bg-background/80"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold tracking-wide text-foreground/80">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/80" />
                        <Input 
                          placeholder="••••••••" 
                          type="password" 
                          disabled={isLoading}
                          className="pl-9 bg-background/50 border-border/80 focus:bg-background/80"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mt-2 font-semibold tracking-wide" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-foreground" />
                    Registering...
                  </>
                ) : (
                  "Sign Up"
                )}
              </Button>
              <div className="text-center text-xs text-muted-foreground mt-4">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-semibold transition-colors duration-200">
                  Sign in
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/30 rounded-b-lg p-4">
          <p className="text-center text-[10px] text-muted-foreground/60">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
