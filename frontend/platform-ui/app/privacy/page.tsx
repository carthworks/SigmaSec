import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, CheckCircle2, Lock, Globe } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Handling — SigmaSec",
  description: "How SigmaSec handles source code, scan results, AI processing and where data is stored.",
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
            <h3 className="text-sm font-bold text-white mb-1">Self-Host Option</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Self-host SigmaSec and your code never leaves your infrastructure. On the hosted service, repositories are cloned only for the duration of a scan.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Lock className="w-5 h-5 text-cyan-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">No AI Training</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              SigmaSec doesn&apos;t train or fine-tune models on customer data. AI can run fully local (Ollama) or on Claude via Anthropic&apos;s API.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
            <Globe className="w-5 h-5 text-purple-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Data Residency</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Self-hosted deployments keep data wherever you run them, including Indian cloud regions. For the hosted service, ask us for the current region.
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
              SigmaSec collects only what it needs to scan, prioritise and help remediate vulnerabilities:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Account information (name, work email address, organization identity, authentication credentials).</li>
              <li>Vulnerability finding metadata (CVE IDs, EPSS scores, CVSS vectors, file paths and tool execution logs).</li>
              <li>Short code snippets around a vulnerable dependency&apos;s call sites, used for the dependency usage check.</li>
              <li>For committed secrets, a masked value and a hash only; raw secret values are never stored.</li>
              <li>Audit records of actions such as scans started, settings changed and fix pull requests opened.</li>
              <li>On the hosted service, repository contents are cloned temporarily during a scan and deleted afterwards.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">02</span> AI Inference &amp; Model Data Usage
            </h2>
            <p className="mb-3">
              SigmaSec uses an AI model to explain findings in plain English and suggest remediation. You choose the model: a local Ollama model, or Anthropic&apos;s Claude API.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Local option: with Ollama, prompts never leave your deployment.</li>
              <li>Claude option: prompts are sent to Anthropic&apos;s API and handled under Anthropic&apos;s commercial terms.</li>
              <li>Before any prompt is sent, recognisable secrets (API keys, tokens, private keys, JWTs) are redacted.</li>
              <li>SigmaSec does not use customer code, findings or prompts to train or fine-tune models.</li>
            </ul>
          </section>

          <section className="border-t border-slate-800 pt-6">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <span className="text-emerald-400 font-mono text-xs">03</span> Data Storage &amp; Security Controls
            </h2>
            <p className="mb-3">
              Current controls (self-hosted deployments inherit the controls of the infrastructure you run them on):
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300 text-xs font-mono">
              <li>Encryption in transit: traffic to the SigmaSec web app and API is served over HTTPS.</li>
              <li>Integration credentials: GitHub, Jira and Slack tokens are encrypted at the application layer before storage.</li>
              <li>Tenant isolation: every query is scoped to your organisation in the application layer.</li>
              <li>Audit logging: scans, settings changes and integration actions are recorded in an audit log.</li>
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
