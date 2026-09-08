import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MessageSquare, MapPin, Building, Clock } from "lucide-react"; 
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Enterprise Pilot Inquiries — SigmaSec",
  description: "Connect with the SigmaSec founders, engineering team, or schedule an enterprise pilot evaluation.",
};

export default function ContactPage() {
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
              CONTACT &amp; SUPPORT
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <span className="text-xs font-mono text-emerald-400 tracking-wider uppercase font-semibold">
            Talk to the Team
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mt-2">
            Contact SigmaSec
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-2">
            We are building in the open. Talk directly to our founders and systems engineers.
          </p>
        </div>

        {/* Contact Channels Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {/* Founder Channel */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Founders &amp; Pilot Onboarding</h3>
                <p className="text-xs text-slate-400">Direct founder channel for security leads</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Evaluating autonomous reachability triage or scheduling a live scoped pilot on your repositories?
            </p>
            <a
              href="mailto:founders@sigmasec.ai"
              className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-3 py-1.5 rounded hover:bg-emerald-900/50 transition-colors"
            >
              founders@sigmasec.ai
            </a>
          </div>

          {/* Technical Support */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Technical Support &amp; Integrations</h3>
                <p className="text-xs text-slate-400">Engineering &amp; scanner troubleshooting</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Questions regarding Opengrep, Trivy, Gitleaks, Nuclei, Nmap, or custom CI/CD pipelines?
            </p>
            <a
              href="mailto:support@sigmasec.ai"
              className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 px-3 py-1.5 rounded hover:bg-cyan-900/50 transition-colors"
            >
              support@sigmasec.ai
            </a>
          </div>
        </div>

        {/* Office & Operations */}
        <section className="border-t border-slate-800 pt-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-400" /> Headquarters &amp; Operations
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-400 font-mono">
            <div className="space-y-2 bg-black/40 border border-slate-900 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Office Location
              </div>
              <p>SigmaSec Technologies Private Limited</p>
              <p>Bengaluru, Karnataka, India</p>
            </div>

            <div className="space-y-2 bg-black/40 border border-slate-900 p-4 rounded-lg">
              <div className="flex items-center gap-2 text-slate-300 font-bold">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Response Expectations
              </div>
              <p>Pilot inquiries: Within 1-2 business days</p>
              <p>Security reports: Acknowledged within 24 hours</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
