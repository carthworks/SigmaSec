import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, CheckCircle2, Lock, Globe } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Handling — SigmaSec",
  description: "How SigmaSec handles source code, scanning telemetry, zero-retention AI processing, and DPDP / GDPR compliance.",
};

export default function PrivacyPage() {
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
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
              DATA PRIVACY
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-xs font-mono text-emerald-400 tracking-wider uppercase font-semibold">
            Trust &amp; Transparency
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Privacy Policy &amp; Data Handling
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-2">
            Effective Date: September 2026 · Version 1.2
          </p>
        </div>

        {/* Highlight Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Code Stays Yours</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Scanners run in your environment. We receive finding fingerprints, not full proprietary repositories.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Lock className="w-5 h-5 text-cyan-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Zero AI Training</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Customer data is never used to train or fine-tune models. LLM inference runs under strict zero-retention terms.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Globe className="w-5 h-5 text-purple-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Data Residency</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Localised storage options available in India (DPDP Act 2023) or custom European/US cloud regions.
            </p>
          </div>
        </div>

        {/* Legal Sections */}
        <article className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">01</span> Information We Collect
            </h2>
            <p className="mb-3">
              SigmaSec collects only the telemetry necessary to provide autonomous vulnerability triage, reachability analysis, and automated remediation workflows:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Account information (name, work email address, organization identity, authentication credentials).</li>
              <li>Vulnerability finding metadata (CVE IDs, EPSS scores, CVSS vectors, and tool execution logs).</li>
              <li>AST call-graph reachability paths extracted by local parser engines (e.g. function call references).</li>
              <li>Audit trails of accepted or rejected pull requests and remediation actions.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">02</span> AI Inference &amp; Model Data Usage
            </h2>
            <p className="mb-3">
              SigmaSec uses Anthropic Claude and local Ollama inference models to analyze exploitability and synthesize patch diffs:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Zero Data Retention: Model inference requests are processed ephemerally and discarded immediately after response synthesis.</li>
              <li>No Model Training: Customer code fragments, vulnerability logs, and prompt contexts are strictly prohibited from being used to train, evaluate, or improve any public or private artificial intelligence models.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">03</span> Data Storage &amp; Security Controls
            </h2>
            <p className="mb-3">
              All stored telemetry is protected with defense-in-depth controls:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Encryption in Transit: Mandatory TLS 1.3 encryption across all public and internal service boundaries.</li>
              <li>Encryption at Rest: AES-256 encryption applied to all database records and storage volumes.</li>
              <li>Tenant Isolation: Cryptographic row-level security ensuring complete multi-tenant tenant isolation.</li>
              <li>Audit Logging: Immutable tamper-evident audit logs recording all data access and administrative operations.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">04</span> Contact Information
            </h2>
            <p className="text-slate-400">
              For questions regarding this policy or data protection inquiries, contact our data protection team directly at{" "}
              <a href="mailto:privacy@sigmasec.ai" className="text-emerald-400 hover:underline">
                privacy@sigmasec.ai
              </a>.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
