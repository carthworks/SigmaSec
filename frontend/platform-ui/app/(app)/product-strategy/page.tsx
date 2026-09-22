import {
    ArrowRight,
    CheckCircle2,
    Gauge,
    GitPullRequest,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    Target,
    Wrench,
} from "lucide-react";

const roadmap = [
  {
    phase: "01",
    title: "Developer workflow",
    description: "Make GitHub the place where SigmaSec is discovered, understood, and acted on.",
    items: [
      "GitHub App self-service installation",
      "Repository onboarding and selection",
      "Pull-request and diff scanning",
      "Inline findings and developer comments",
      "GitHub Actions and merge protection",
    ],
  },
  {
    phase: "02",
    title: "Intelligent prioritization",
    description: "Turn raw scanner output into evidence-backed decisions about what matters.",
    items: [
      "Finding correlation across scanners",
      "Reachability and dependency context",
      "Risk prioritization and confidence scoring",
      "Evidence-based AI explanations",
      "External input to vulnerable function paths",
    ],
  },
  {
    phase: "03",
    title: "Automated remediation",
    description: "Reduce the effort required to produce a safe, reviewable fix.",
    items: [
      "Patch generation with file and line context",
      "Static and security validation",
      "Unit and integration test execution",
      "Diff previews and remediation PRs",
      "Human approval before merge",
    ],
  },
  {
    phase: "04",
    title: "Enterprise platform",
    description: "Expand the proven workflow for larger teams and governance requirements.",
    items: [
      "SAML/OIDC SSO and granular RBAC",
      "Audit logs and security event history",
      "Continuous compliance evidence",
      "IaC and cloud security integrations",
      "Organization-wide policies and reporting",
    ],
  },
];

const outcomes = [
  ["Mean time to remediate", "How quickly findings move from discovery to closure."],
  ["False-positive reduction", "How many findings leave the unnecessary-investigation queue."],
  ["Autofix acceptance rate", "How often developers accept generated remediation PRs."],
  ["Reachable vulnerability rate", "The proportion of findings with an established execution path."],
  ["Critical issues blocked", "High-risk issues prevented from entering protected branches."],
  ["Developer remediation time", "The engineering effort required to resolve security work."],
];

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="max-w-2xl space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function ProductStrategyPage() {
  return (
    <main className="min-h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-7xl space-y-16 px-6 py-10 lg:px-10 lg:py-14">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 shadow-sm md:px-10 md:py-14">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-4xl space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Target className="h-4 w-4 text-primary" />
              Product strategy · Internal
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              From more scanners to more signal.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              SigmaSec should focus on proving which vulnerabilities matter, explaining why they matter, and helping developers fix them directly inside GitHub.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2 text-sm font-semibold">
              <span className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Reachability-aware GitHub security</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border border-border bg-background px-4 py-2 text-foreground">Automated remediation PRs</span>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <SectionHeading
              eyebrow="The opportunity"
              title="Detection is becoming commoditized. Decision-making is not."
              description="Engineering teams already have SAST, SCA, secret, container, IaC, cloud, and API scanners. Their problem is the growing gap between findings generated and findings that deserve human action."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Too many disconnected findings",
                "Unclear exploitability and reachability",
                "Manual triage across teams",
                "Slow ticket-to-fix workflows",
              ].map((pain) => (
                <div key={pain} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  {pain}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The product promise</p>
            <p className="mt-4 text-2xl font-semibold leading-tight text-foreground">
              Find the vulnerabilities that actually matter and open the fix PR automatically.
            </p>
            <div className="mt-6 space-y-3 text-sm text-muted-foreground">
              {["Detect", "Validate", "Prioritize", "Explain", "Fix"].map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</span>
                  <span className="font-medium text-foreground">{step}</span>
                  {index < 4 && <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-7">
          <SectionHeading
            eyebrow="Initial customer"
            title="Start with teams that already have security tooling but not enough signal."
            description="The first customer profile is intentionally narrow: GitHub-centered companies with 20–500 engineers, small AppSec teams, multiple scanners, large finding volumes, and developers responsible for remediation."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["The pain", "We have security tooling, but we cannot efficiently determine what matters."],
              ["The buyer", "AppSec leaders, security managers, and engineering leaders under remediation pressure."],
              ["The wedge", "A shorter path from security finding to verified risk to safe remediation."],
            ].map(([title, text]) => (
              <article key={title} className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-7">
          <SectionHeading
            eyebrow="Developer surface"
            title="GitHub should be the primary place where security work happens."
            description="The dashboard remains valuable for security and compliance teams, but developers should not need to leave their pull request to understand or begin fixing a security issue."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {["Pull-request scan", "Reachability evidence", "Inline explanation", "Reviewed fix PR"].map((step, index) => (
              <div key={step} className="relative rounded-xl border border-border bg-card p-5">
                <GitPullRequest className="h-5 w-5 text-primary" />
                <p className="mt-5 text-sm font-semibold text-foreground">{step}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Step {index + 1} of the developer workflow</p>
                {index < 3 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 bg-background text-muted-foreground lg:block" />}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-7">
          <SectionHeading
            eyebrow="Roadmap"
            title="Build the workflow in four focused phases."
            description="Each phase should earn the next one. Enterprise breadth comes after the core GitHub workflow demonstrates measurable reductions in triage and remediation effort."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {roadmap.map((phase) => (
              <article key={phase.phase} className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold tracking-[0.15em] text-primary">PHASE {phase.phase}</p>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">{phase.title}</h3>
                  </div>
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{phase.description}</p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-2 text-xs leading-5 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <SectionHeading
              eyebrow="Trust requirements"
              title="AI should show its work."
              description="Security teams will not trust unsupported AI claims or blind production changes. Every recommendation needs evidence, validation, and human approval."
            />
            <div className="space-y-3">
              {["Affected file and line", "Scanner source and reachability evidence", "Exploitability reasoning and confidence", "Validation results and remaining risks"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Safe remediation pipeline</h3>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Context", "Patch", "Static validation", "Security validation", "Tests", "Diff", "Human review"].map((item, index) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground">{item}</span>
                  {index < 6 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">The goal is not autonomous code modification at any cost. It is reducing the human effort required to produce a safe fix.</p>
          </div>
        </section>

        <section className="space-y-7">
          <SectionHeading
            eyebrow="Measure value"
            title="Prove outcomes, not scanner activity."
            description="A large number of findings is not a product outcome. SigmaSec should make the reduction in security workload visible to customers and design partners."
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {outcomes.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-border bg-card p-5">
                <Gauge className="h-4 w-4 text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-primary/25 bg-primary/5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <Target className="mt-1 h-6 w-6 shrink-0 text-primary" />
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Next milestone</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Find 5–10 design partners and measure the change.</h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Capture their baseline triage volume, false positives, remediation time, and developer effort. Deploy SigmaSec, then prove whether the workflow reduces human effort and prevents meaningful vulnerabilities from reaching protected branches.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
