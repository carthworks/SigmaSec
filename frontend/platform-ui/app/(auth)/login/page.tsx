import { LoginForm } from "@/components/login-form";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-[#070B12] text-[#EDF1F8] p-4 sm:p-6 overflow-hidden selection:bg-[#7C6CF6]/30 selection:text-[#9C8FFF]">
      {/* Background Subtle Gradient Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_50%_20%,rgba(124,108,246,0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Header Navigation Link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#A3AEC2] hover:text-[#EDF1F8] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#7C6CF6] group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>
      </div>

      {/* Main Centered Login Container */}
      <div className="relative z-10 w-full max-w-md space-y-6 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C6CF6]/20 border border-[#7C6CF6]/30 shadow-[0_0_20px_rgba(124,108,246,0.15)] group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5 text-[#9C8FFF]" />
            </div>
            <span className="text-lg font-bold tracking-tight text-[#EDF1F8]">
              Security Posture <span className="text-[#9C8FFF]">Intelligence</span>
            </span>
          </Link>
          <p className="text-xs text-[#A3AEC2]">
            Sign in to access your security posture dashboard and threat findings
          </p>
        </div>

        {/* Simplified Login Form */}
        <LoginForm />

        {/* Footer Note */}
        <div className="text-center text-[11px] text-[#6E7A8F]">
          Protected by SigmaSec Security Platform · Encrypted End-to-End
        </div>
      </div>
    </div>
  );
}
