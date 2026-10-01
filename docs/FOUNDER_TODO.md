# Founder TODO — facts only you can confirm

The website copy now makes only claims the code supports. These lines were
written conservatively because they depend on facts outside the code. Confirm
or correct each one, then update the copy.

| # | Question | Where the copy is | Current (safe) wording |
|---|---|---|---|
| 1 | Do we have a signed zero-data-retention (ZDR) agreement with Anthropic? | `app/page.tsx` trust table row "Do you train on our data?" (~L2025); `app/privacy/page.tsx` "No AI Training" card and section 02 | No ZDR claim. Says AI can run locally (Ollama) or on Claude under Anthropic's commercial terms. If ZDR is signed, add it back. |
| 2 | Where does the hosted service actually run, and do we offer India hosting? | `app/page.tsx` trust row "Where is metadata stored?" (~L2033); `app/privacy/page.tsx` "Data Residency" card | Self-hosted runs anywhere, including Indian regions; hosted says "ask us for the current region". |
| 3 | SOC 2: is an auditor engaged, and for which type and date? | `app/page.tsx` trust row "Are you SOC 2 audited?" (~L2040) | "Not yet." |
| 4 | Are the team bios right, and what would you like to say? | `app/page.tsx` team section (~L2079, ~L2087) | Platform: security, applied cryptography, AI, post-quantum TLS, embedded. Engineering: 15+ years in frontend/product for banking, SaaS and AI. |
| 5 | Do we own `sigmasec.ai`, and do `founders@sigmasec.ai` and `privacy@sigmasec.ai` receive mail? | `app/page.tsx` footer (~L2174) and error toast (~L1472); `app/privacy/page.tsx` contact (~L128) | Unchanged. Remove or replace if not set up — a bouncing privacy address is a problem for a security product. |
| 6 | Should the privacy policy and terms get a legal review before pilots? | `app/privacy/page.tsx`, `app/terms/page.tsx` | Factual errors corrected; no new legal commitments added. |

Also not yet built (copy now says "coming soon" or omits them): exploit
validation, API tokens, email notifications, private-VPC Terraform modules,
cross-engine dedup, entry-point reachability.
