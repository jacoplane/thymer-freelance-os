# Product Bench — design

Status: slices 1 and 2 implemented 2026-11-12; slice 1 dogfooded on Eventual. The 90-day validation gate now governs product investment, not bench scope.

## Problem

Freelance OS ships 11 core personas. All of them assume an external client, a bounded engagement, and a payment; their terminal state is "the invoice clears." A solo product business — for example an events plugin for EmDash CMS — has anonymous customers, license terms, a platform marketplace, versioned releases, and revenue per unit. The existing bench misfires:

| Product need | Closest persona | Why it misfits |
| :--- | :--- | :--- |
| License / EULA | Contract Clause Guardian | Audits a client's MSA to protect the supplier; licensing means authoring terms for unknown buyers, plus marketplace policy and code IP. |
| Pricing / packaging | Pricing Analyst | Value-based project pricing and retainers; no tiers, freemium split, per-site/seat pricing, or price-change policy. |
| Product marketing | Outbound Strategist / Lead Gen Offer Architect | One-to-one cold outreach and service audits; no positioning, listing copy, demo assets, or launch sequencing. |
| Competitive landscape | — | No coverage. |
| Build / kill decision | Reality Checker (partly) | Audits deliverables against budget, not demand, differentiation, or opportunity cost. |
| Docs, support, refunds | Client Onboarding Shepherd (inverted) | Onboards one client into a service; a product needs self-serve docs, FAQ, support triage, and churn signals. |
| Roadmap / releases | Project Manager (partly) | Plans client milestones; products need versioning, upgrade paths, deprecation, and changelogs. |

The missing jobs cluster into three stages: **validate** (demand, competitors, differentiation), **commercialize** (license, packaging, pricing), and **distribute** (positioning, launch, listing, support, roadmap).

## Platform-bet context

EmDash is a new Astro-based CMS with a young, API-first plugin registry. Direct competitors will be scarce for a while, so a conventional teardown would produce an empty table and a misleading "no market" verdict. For an early platform bet, the useful question is not "how big is this market today" but "is the platform gaining momentum, how long is the window, and what makes an early entrant hard to displace once it grows."

The product bench therefore must treat absence of competitors as expected, and separately test platform momentum, buyer readiness, supply gap, window, and defensibility.

## Decisions

1. **Separate bench.** Add `PRODUCT_AGENTS` alongside `CORE_AGENTS` in `src/ai.js`. The existing 11 agency personas and the `CORE_AGENTS.length === 11` invariant stay untouched.
2. **Slice 1 shipped `product-market-scout` first.** It was dogfooded on the EmDash events plugin before the other two were written.
3. **Early-platform mode switch.** When the direct field is thin (fewer than three credible products) or the marketplace is immature, the scout runs a Platform Bet Assessment instead of a competitor teardown.
4. **No schema change.** Product work uses a clientless Project (`client` unset, `fee_type: non_billable`, `status: in_progress`). Research lives in a Library note linked to that project.
5. **Slice 2 shipped on 2026-11-12 at the owner's request:** `product-license-architect` (commercialize) and `product-marketer` (distribute). Pricing placement stays open: a `product-pricing-strategist` or a supplier mode on `pricing-analyst`.

## Product Market Scout

**Directive:** kill weak product bets early or sharpen strong ones with evidence. It is not a cheerleader and not a TAM generator.

**Inputs:** product one-liner, target buyer, platform, current stage, price hypothesis if any. Missing context is collected one question at a time.

**Workflow:**

1. Frame the bet: category, buyer, job-to-be-done, and the real substitute, including "do nothing" and "build it in Astro."
2. Map the field in three rings: direct EmDash plugins, adjacent-platform equivalents (WordPress, Craft, Statamic), and DIY/configuration alternatives.
3. Evidence table: product, price, model, feature coverage, install/review signals where visible, last release, and the gap left. Every row cites a URL and a date.
4. Demand signals: registry searches, GitHub issues/stars, npm activity, forum and Reddit threads, repeated "how do I do events in EmDash" questions. Distinguish *no competitors* from *no demand*.
5. Verdict: the wedge worth owning, what not to build, and a confidence level.
6. Validation plan: three to five cheap next evidence steps with explicit kill criteria.

**Platform Bet Assessment** — five evidence-rated dimensions:

- **Platform momentum:** core release cadence, plugin/theme growth, GitHub activity, community size, first-party investment.
- **Buyer readiness:** are site owners spending on plugins yet, or still building?
- **Supply gap:** quality and depth of existing events options.
- **Window:** how long before credible fast followers arrive.
- **Defensibility:** distribution, integrations, data, brand, agency relationships — things copying cannot buy.

**Verdict postures:**

- **Commit** — momentum and gap both strong; invest now.
- **Probe** — promising but unproven; ship the smallest paid version and set escalation triggers.
- **Educate / wait** — too early; build reputation and content, do not overbuild.
- **Avoid** — weak momentum or no defensibility.

Comparisons use early-stage analogues (WordPress in 2005, early Shopify app store, early Craft), never today's WordPress. Platform risk (API churn, marketplace policy, single-vendor dependency) is recorded with a mitigation note. The output includes a **Bet thesis**: what must be true, and which signal would change the decision.

**Output:** a `Competitive Teardown — <product> — <date>` Library note (`type: note`) linked to the internal project, containing the three-ring map or Platform Bet Assessment, dated citations, a confidence label per claim, and the Bet thesis. Optional validation tasks with deadlines. The note is previewed and approved before writing.

**Guardrails:** cite prices and claims with source and date; label inference separately from fact; say "marketplace data unavailable" instead of guessing; never invent install or revenue numbers.

## Product License Architect

**Directive:** turn the free/paid boundary into a coherent licence, terms of sale, and distribution wrapper. Draft and issue-spot; do not certify.

**Inputs:** product, buyer type, jurisdictions, distribution channel, free/paid boundary, price basis, what the buyer receives, open-source components, personal-data flows, and any existing terms. Read the repository `LICENSE`, licence facts, and website terms before asking.

**Workflow:**

1. Choose the licence architecture: open core, source-available, proprietary, free plus paid services, or usage-based.
2. Record the grant, restrictions, updates, support, fees, refunds, acceptance, termination, IP, privacy, liability, and governing law.
3. Check marketplace rules: SPDX value, listing price, permissions, security contact, and whether the marketplace handles payment at all.
4. Separate tax, privacy, and consumer-law questions; never invent a VAT fact.
5. Choose the lightest enforcement that fits the price: terms only, offline key, online activation, or private distribution.
6. Produce a lawyer brief with the exact questions and clause numbers.

**Output:** a `License & Commercial Model — <product> — <date>` Library note with the decision, terms map, obligations, legal-review brief, publish checklist, and open questions. Link it to the product project and add only the tasks the owner wants.

**Guardrails:** not legal advice; require a qualified local lawyer before terms are in force; do not copy another vendor's terms; never promise enforceability; keep a lapsed licence from breaking live orders or data.

## Product Marketer

**Directive:** make the product legible to one buyer and get it in front of them through channels a solo founder can sustain. Position first; distribute second.

**Inputs:** product, buyer, current alternative, differentiator, proof, price, stage, and the founder's time and language constraints. Read the product project, registry listing, website, and prior research before asking.

**Workflow:**

1. Write one positioning sentence: buyer, job, category, differentiator, alternative, proof.
2. Build the message hierarchy: category, promise, three proof pillars, three objections, and who it is not for.
3. Choose at most three channels for 90 days: owned, earned, partner, or paid.
4. Plan pre-launch, launch week, and the first 30–90 days.
5. Produce the asset checklist: registry copy, hero, proof bullets, comparison page, demo script, launch posts, partner one-pager, FAQ.
6. Define the metric and kill criterion for each channel before starting.

**Output:** a `Go-to-Market — <product> — <date>` Library note with positioning, channels, launch sequence, assets, measurement, and open questions. Link it to the product project and add only the launch tasks the owner wants.

**Guardrails:** no invented proof or urgency; no spam; disclose that you are the maker; say what the product does today; escalate legal, privacy, and security claims to the license architect.

## Placement and UI

- `src/ai.js` exports `PRODUCT_AGENTS` with the same metadata shape as `CORE_AGENTS` plus `stage` (`validate` / `commercialize` / `distribute`).
- The AI tab renders two directory sections: **Client Services** (the existing 11) and **Your Own Products** (the new bench), using the same card and copy-prompt behavior with a Product badge.
- Installer commands are unchanged: every harness copies the whole `.agents` folder via `npx degit`.
- Tests keep `CORE_AGENTS.length === 11`, add a `PRODUCT_AGENTS` metadata contract test, and assert that every product agent `id` has a matching `.agents/skills/<id>/SKILL.md`.

## Freelance OS skill updates

`.agents/skills/freelance-os/SKILL.md` requires these changes:

1. **Frontmatter:** mention own products alongside client work so the skill triggers on product questions.
2. **Trigger table:** add a Product / own-IP row routing validation questions to `product-market-scout`.
3. **Schema drift fix:** the Projects `status` list currently says `active / completed / on_hold / cancelled`; align it with the real choices `backlog / in_progress / in_review / completed / archived / cancelled` and the existing `in_progress` mandate.
4. **Internal product convention:** document clientless projects (`client: null`, `fee_type: non_billable`, `status: in_progress`) and the Library research note.
5. **Internal product project archetype:** Product thesis, Market evidence, License & pricing, Release log, Next actions — with no client review checkpoints.
6. **Revenue boundary:** product sales must not be booked as client Invoices; product revenue tracking is out of scope until a Products collection exists.
7. **Watchdogs:** product-specific nudges are still deferred. The three personas cover validation, licensing, and marketing; none of them runs automatically yet.

## Data flow and failure handling

- **Trigger:** a product market question; collect missing context first.
- **Reads:** internal project, prior Library notes, live sources when available (EmDash registry/API, GitHub, npm, docs, forums).
- **Writes:** one dated Library note plus optional validation tasks; preview and approve first.
- **No web access:** structured interview plus local evidence, labeled "Desk research only — no live sources." Never fabricate findings.
- **No marketplace metrics:** state the limitation and use registry/GitHub/npm proxies.
- **Sparse field:** switch to Platform Bet Assessment; do not present an empty table as a finding.
- **Prior teardown:** create a new dated note and link the old one; never overwrite.
- **Idempotency:** reuse the existing clientless product project rather than creating duplicates.

## Implementation file list

**Slice 1:**

- `.agents/skills/product-market-scout/SKILL.md` (new)
- `.agents/skills/freelance-os/SKILL.md` (updates above)
- `src/ai.js` (`PRODUCT_AGENTS`, AI tab section, copy strings)
- `test/ai.test.mjs` (contract and folder checks)
- `README.md`, `CHANGELOG.md`
- this document

**Slice 2:**

- `.agents/skills/product-license-architect/SKILL.md` (new)
- `.agents/skills/product-marketer/SKILL.md` (new)
- `src/ai.js` (`PRODUCT_AGENTS` entries)
- `test/ai.test.mjs` (three-persona contract and render assertions)
- `README.md`, `CHANGELOG.md`, this document

## Definition of done

- `npm run build` clean.
- Full unit test suite passing.
- AI tab renders both benches, including the Product badge and copy-prompt action.
- One real dogfood run on the EmDash events plugin produces an actionable Platform Bet Assessment rather than an empty competitor table.

## Dogfood result — Eventual, 2026-11-12

- **Input found without asking:** the jacoplane workspace held the Eventual suite, its five subprojects, stage, model, and release runbook. The scout read the project record first; the only missing inputs were the buyer and wedge.
- **Output:** a `Competitive Teardown — Eventual — 2026-11-12` Library note, linked under a new Market evidence section, plus four dated validation tasks with kill criteria.
- **What the run caught:** the project note still said "zero npm/registry publish" after Core 0.17.0 had been listed on 7 Nov. Registry verification corrected it.
- **What changed the verdict:** the category is not empty. semics Events is a credible competitor with about 1,978 npm downloads in 30 days and Pro pricing of USD 79 per site, USD 129 for the suite, and USD 349 for the agency plan. The verdict stayed Probe, but the pricing context shifted: USD 30 is a deliberate penetration price, not a ceiling.
- **Skill change:** Inputs now require reading the existing product record and verifying release state from the registry, npm, or GitHub before asking the user.
- **Gate:** later slices were released from the gate by the owner's 2026-11-12 decision. The 90-day validation still governs product investment, not the bench scope.

## Later slices

- Pricing — new persona or supplier mode, decided when the product bench has real pricing work.
- Optional Products collection — customers, license revenue, releases — only if product work outgrows clientless projects and Library notes.
