"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Loader2, Key, Mail } from "lucide-react";
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

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  rememberMe: z.boolean(),
});


type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    console.log("LoginForm submitted values:", values);
    
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        rememberMe: String(values.rememberMe),
        redirect: false,
      });

      if (result?.error) {
        toast.error("Authentication Failed", {
          description: result.error,
        });
      } else {
        toast.success("Authentication Successful", {
          description: "Welcome back! Redirecting to dashboard...",
        });
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error: any) {
      toast.error("Authentication Error", {
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Trigger popups for validation errors when form submission is attempted with invalid fields
  const onError = (errors: any) => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length > 0) {
      // Pop the first validation error
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
      {/* Glassmorphic Container Card with Premium Hover Effect */}
      <Card className="border border-border/80 bg-card/70 backdrop-blur-md shadow-xl hover:shadow-2xl hover:border-primary/20 transition-all duration-300 transform hover:-translate-y-0.5">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="flex justify-center">
            {/* Animated Shield Badge */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 animate-pulse">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Sign In
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Secure connection. Authenticate to manage security posture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-4">
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
                          placeholder="name@example.com" 
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
                          autoCapitalize="none"
                          autoComplete="current-password"
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
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0 py-2">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={isLoading}
                        className="h-4 w-4 rounded border-border/80 bg-background/50 text-primary focus:ring-primary/20 accent-primary"
                        id="rememberMe"
                      />
                    </FormControl>
                    <label
                      htmlFor="rememberMe"
                      className="text-xs font-medium leading-none text-muted-foreground cursor-pointer select-none"
                    >
                      Remember me for 30 days
                    </label>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full mt-2 font-semibold tracking-wide" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary-foreground" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
              <div className="text-center text-xs text-muted-foreground mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline font-semibold transition-colors duration-200">
                  Sign up
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center border-t border-border/60 bg-muted/30 rounded-b-lg p-4 gap-2">
          {/* Quick instructions */}
          <div className="text-[10px] text-muted-foreground bg-background/50 rounded px-2.5 py-1 border border-border/40 text-center w-full">
            <span className="font-semibold text-primary">Credentials:</span> Admin: <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">admin@sigmasec.com</code> / <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Admin@12345!</code>
          </div>
          <p className="text-center text-[10px] text-muted-foreground/60 mt-1">
            Proprietary platform. Unauthorized access is strictly audited.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
