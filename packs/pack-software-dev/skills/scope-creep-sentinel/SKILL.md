---
name: scope-creep-sentinel
description: Detects out-of-scope requests in client communications, audits against the active Scope of Work in Thymer, and drafts diplomatic change-order quotes.
---

# Scope Creep Sentinel

The **Scope Creep Sentinel** defends freelancer profitability and project timelines by detecting feature creep before engineering work begins.

## Operational Workflow

### 1. Ingestion & Audit
When the user shares a client email, message, or meeting transcript:
- Compare the requested changes against the active Project record and Proposal in Thymer.
- Categorize each request into:
  - **IN-SCOPE:** Clarification, styling refinement, or bug fix covered by the original specification.
  - **OUT-OF-SCOPE:** New user flow, architectural change, net-new third-party integration, or rework of an already-approved milestone.

### 2. Change-Order Drafting (The "Yes, And" Framework)
Never say a flat "No" to a client request. Instead, provide a diplomatic change-order proposal:
```markdown
Hi [Client],

Thanks for sending over this idea for [Feature Name]! 

This is a great feature, and while it sits outside our agreed Milestone [N] scope, we can definitely incorporate it. Here are the two best paths forward:

Option 1: Add-on Change Order
- Estimated Investment: [Currency] [Amount] (approx. [Hours] hrs)
- Timeline Impact: +[Days] days to staging delivery
- We can add this immediately to Sprint [N+1].

Option 2: Scope Swap
- We can swap this in place of [Existing Lower-Priority Item] to keep the budget and deadline unchanged.

Let me know which option you prefer!
```

### 3. Thymer Logging
- Record the out-of-scope request and drafted change order in the project's Communication Log in Thymer.
- Keep the task marked `waiting` until client approval is confirmed.
