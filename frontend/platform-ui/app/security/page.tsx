import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, KeyRound, Lock, AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Responsible Disclosure & Security Posture — SigmaSec",
  description: "SigmaSec vulnerability reporting guidelines, safe harbor policy, and platform infrastructure security standards.",
};

export default function SecurityDisclosurePage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 antialiased">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800 bg-[#07090e]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">SigmaSec</span>
            <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded">
              SECURITY &amp; DISCLOSURE
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-xs font-mono text-rose-400 tracking-wider uppercase font-semibold">
            Vulnerability Reporting &amp; Defense Standards
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Responsible Disclosure Policy
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-2">
            We welcome vulnerability disclosures from researchers working in good faith.
          </p>
        </div>

        {/* Security Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <ShieldAlert className="w-5 h-5 text-rose-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Safe Harbor</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We will not initiate legal action against researchers acting in good faith under our guidelines.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <KeyRound className="w-5 h-5 text-amber-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Strict Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Never access or alter customer data. Testing must only target your own test accounts and assets.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Lock className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">SLA Response</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We acknowledge vulnerability reports within 24 hours and provide regular remediation updates.
            </p>
          </div>
        </div>

        <article className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-rose-400 font-mono text-xs">01</span> How to Report a Vulnerability
            </h2>
            <p className="mb-3">
              If you identify a security vulnerability in SigmaSec services, please report it immediately to our security response team:
            </p>
            <div className="bg-black/60 border border-slate-800 p-4 rounded-lg font-mono text-xs text-slate-300 space-y-1">
              <p>Email: <span className="text-rose-400 font-bold">security@sigmasec.ai</span></p>
              <p>Subject: [VULNERABILITY DISCLOSURE] Short summary</p>
              <p className="text-slate-500 pt-1">Please include reproduction steps, HTTP requests/responses, and potential impact.</p>
            </div>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-rose-400 font-mono text-xs">02</span> In-Scope Domains
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs font-mono text-slate-300">
              <li><code>*.sigmasec.ai</code> web applications and authentication services.</li>
              <li>SigmaSec API backend microservices.</li>
              <li>Core scanner adapter worker daemons.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-rose-400 font-mono text-xs">03</span> Prohibited Testing
            </h2>
            <p className="mb-2">The following testing methodologies are strictly out of scope:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs font-mono text-slate-400">
              <li>Denial of service (DoS / DDoS) attacks.</li>
              <li>Spam, phishing, or social engineering targeting SigmaSec employees.</li>
              <li>Physical security attacks against hosting facilities.</li>
              <li>Modifying or accessing other customers&apos; data.</li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
