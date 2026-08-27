# Security Posture Intelligence — Prioritised Feature Backlog

Consolidated from the platform, AI pipeline, dashboard, and landing page reviews.
Ordered by what unblocks what — not by category.

Effort is rough calendar time for a two-person team, assuming this isn't the only thing being worked on.

---

## P0 — Do these before anything else

Things that are either already-built value you aren't using, or active credibility risks.

| ID | Feature | Why it's P0 | Effort |
|---|---|---|---|
| **P0-1** | Feed reachability + exploit validation into the AI payload | You built the two signals no competitor can copy and the model never sees them. Everything currently fed is public data, so the model produces generic output. Highest value-to-effort item on this entire list. | 3–5 d |
| **P0-2** | Remove `severity_override` from the LLM | Scoring must be deterministic, reproducible, auditable. "The model decided" fails a vendor assessment. Move to a scoring function in code; let the model write `score_explanation` instead. | 1 w |
| **P0-3** | Fix or remove the patch diff | The schema asks for a unified diff but the payload contains only a file path — every diff is fabricated. A diff that won't apply is worse than none. Pass file contents, or drop the field until you can. | 3 d |
| **P0-4** | Baseline scanning | New customers get 1,204 findings on day one, decide it's unwinnable, and never return. Baseline mutes the backlog and shows only what's new. Single biggest adoption lever in this document. | 1 w |
| **P0-5** | `confidence` + `insufficient_context` in the output schema | Gives the model a licensed way to say "not enough information." Without an escape hatch, a schema demanding a patch always gets one — invented if necessary. | 2 d |
| **P0-6** | Landing page: remove "Mockup", align numbers with the real product | Your product screenshot currently announces itself as fake. Reads as "no product exists." | Done |

---

## P1 — Required for first paying customers

Adoption and daily-use mechanics. Without these, people try the product and drift away.

| ID | Feature | Why | Effort |
|---|---|---|---|
| **P1-1** | CLI + public API | Security teams automate everything. This is how you become infrastructure instead of a dashboard nobody opens. Also unblocks P1-2. | 2 w |
| **P1-2** | PR comments / GitHub Check run | Findings appear inline on the diff, where developers already are. Largest single driver of AppSec tool adoption. | 1.5 w |
| **P1-3** | Posture score (real formula) | Marketing promises it; the product doesn't have it. Needs a documented, defensible formula with a public "how this is scored" explanation. | 1 w |
| **P1-4** | CVE-level response caching | Same CVE across 50 repos shouldn't cost 50 inference runs. Cache canonical explanation on `CVE + package + version_range`, small per-repo call for specifics. Order-of-magnitude cost cut, and faster responses. | 1 w |
| **P1-5** | Asset auto-discovery | Manual asset entry doesn't survive a real org. "You have 47 repos, 12 unscanned" is an alarming and useful first screen. | 1 w |
| **P1-6** | Risk acceptance with expiry | Accepting forever is how findings quietly vanish. 90-day acceptance with mandatory re-review is what auditors and security leads both want. | 4 d |
| **P1-7** | Daily digest of new actionable findings | Only new + actionable. Per-finding alerts get muted within a week, and then you're invisible. | 3 d |
| **P1-8** | Tier or route the model explicitly | Claude and Ollama behind one schema produce identical-looking output of very different quality. Route by task, or label the tier. Also: Claude 3.5 is several generations behind — check current models. | 3 d |

---

## P2 — Required to close an enterprise deal

Unglamorous. Each one is a hard blocker in procurement.

| ID | Feature | Why | Effort |
|---|---|---|---|
| **P2-1** | Orgs, teams, RBAC | You have one admin account. Buyers ask who can see what before they ask what your AI does. | 2 w |
| **P2-2** | SSO — SAML / OIDC | Kills more deals than any missing capability. Legitimate paid-tier gate. | 1.5 w |
| **P2-3** | Audit log | Who scanned, who accepted risk, who dismissed what. Needed for your own SOC 2 regardless. | 1 w |
| **P2-4** | Policy engine / build gating | "Fail the build on a KEV-listed, reachable critical." Turns detection into a *control* — a different budget line and a far stickier product. | 2 w |
| **P2-5** | Bidirectional Jira sync | One-way creates two sources of truth and people stop trusting both. | 1 w |
| **P2-6** | Trust page + documentation | Data flow diagram, model providers, retention, residency, subprocessors. Table stakes for security buyers. | 1 w |
| **P2-7** | Compliance mapping — SOC 2 / ISO 27001 / PCI / DPDP | Boring work, different buyer, different budget, hard deadline. In India, DPDP readiness is a live purchasing trigger. Possibly your fastest path to revenue. | 3 w |

---

## P3 — Moat

Differentiation. Do these once the product is retained, not before.

| ID | Feature | Why | Effort |
|---|---|---|---|
| **P3-1** | **Verification loop** — patch → re-run exploit in sandbox → confirm it now fails | Converts the AI from suggestion engine to verification engine. Answers the objection every buyer has: "how do I know the patch works?" Strongest demo moment available to you. | 2–3 w |
| **P3-2** | Opengrep SAST | Closes the "you don't scan my code?" gap. Architecturally adjacent to reachability, which you've already built. Use Opengrep, not Semgrep — the Semgrep rules licence forbids competing SaaS use. Write your own rule pack. | 3 w |
| **P3-3** | Upstream fix commit in AI payload | Real patches exist publicly for most CVEs. Lets the model pattern-match a proven fix rather than invent one. Large jump in patch quality. | 1 w |
| **P3-4** | Consolidated fix PRs | One PR bumping 14 deps, grouped by breakage risk, beats 14 PRs. Teams judge security tools largely on PR noise. | 1.5 w |
| **P3-5** | Regression rules | After a fix merges, auto-generate an Opengrep rule blocking the same class. Every fix permanently raises the floor. Very sticky — customers accumulate a library they can't take with them. | 2 w |
| **P3-6** | Attack path chaining | Medium findings composing into a critical path, shown as a graph. Nobody has done this well on open-source scanners. | 3 w |
| **P3-7** | Introduction forensics | Bisect when a vuln entered — which commit, which PR. Turns "14 problems" into "one dependency bump caused nine of them." | 1 w |
| **P3-8** | Compensating controls + deployment state as AI inputs | WAF rules, auth middleware, whether the branch actually shipped. Without these you over-rank and burn trust. | 2 w |

---

## P4 — Later / optional

| ID | Feature | Note |
|---|---|---|
| **P4-1** | Checkov (IaC) + Prowler (cloud posture) | The strategic expansion — takes you from AppSec tool to the posture platform your name already claims. Cloud misconfig is high-volume, which makes your funnel look better. |
| **P4-2** | Runtime signal (Falco / eBPF) | Static says *could be reached*; runtime says *is reached*. Where serious players are converging. Makes your funnel's last step nearly unarguable. |
| **P4-3** | OWASP ZAP | Real authenticated DAST. Operationally heavy — needs per-target auth config. |
| **P4-4** | Syft (SBOM) | Easy to add, only matters once someone asks. Pure compliance revenue. |
| **P4-5** | Executive View as a separate density | Score, trend, top 5, MTTR on one screen. Different audience, different density. |
| **P4-6** | Audio cues | Scan completion + rare critical alert only. Notifications API for backgrounded tabs. Default off, opt-in. |
| **P4-7** | VEX document ingestion | Standardised machine-readable false-positive killer most platforms ignore. |

---

## Explicitly not now

- **More scanners for their own sake.** Each costs a normaliser, dedup logic, severity mapping, and ongoing maintenance. Four well-normalised beats nine contradictory.
- **A tenth nav item.** You already have nine. The risk from here is a product that does many things adequately and nothing undeniably.
- **TruffleHog, CodeQL.** Licence terms don't permit embedding in a hosted commercial product (AGPL-3.0 and GHAS terms respectively). Get counsel to review the full licence stack before shipping either way.

---

## Suggested sequencing

**Weeks 1–3 · Fix the foundation**
P0-1 → P0-2 → P0-3 → P0-5 → P0-4

Your AI output quality jumps, your scoring becomes defensible, and new customers stop drowning on day one. Nothing new is added — you're making what exists actually work.

**Weeks 4–8 · Make it sticky**
P1-1 → P1-2 → P1-4 → P1-3 → P1-6

CLI and PR comments move you into the developer workflow. Caching makes the unit economics survive growth.

**Weeks 9–14 · Make it sellable**
P2-1 → P2-2 → P2-3 → P2-6 → P2-4

RBAC, SSO, audit log, trust page. Boring, and every enterprise conversation stalls without them.

**Weeks 15+ · Make it undeniable**
P3-1 → P3-2 → P3-3

The verification loop first. It's the thing that makes an evaluator stop comparing you to Snyk.

---

## One judgement call

P2-7 (compliance mapping) is placed in P2 by dependency, but it may deserve to jump the queue commercially. It sells to a buyer with a deadline and a budget, and DPDP is creating that deadline in your home market right now.

If early customer conversations point at compliance rather than developer workflow, reorder — pull P2-7 forward and push P1-2 back. Let the conversations decide, not this list.
