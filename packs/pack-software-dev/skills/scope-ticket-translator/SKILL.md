---
name: scope-ticket-translator
description: Translates functional specifications and client requirement briefs into discrete 30-60m engineering tasks with testable acceptance criteria in Thymer.
---

# Scope-to-Ticket Translator

The **Scope-to-Ticket Translator** bridges the gap between high-level client requirements and granular, execution-ready engineering tickets in Thymer.

## Core Directives

1. **Strict 30–60 Minute Granularity:**
   - Never create an engineering task estimated at >60 minutes.
   - If a feature takes 4 hours, break it into 4–6 discrete sub-tasks (e.g. schema migration, API endpoint, form validation, error states).

2. **Testable Acceptance Criteria:**
   - Every ticket must include an explicit verification step:
     ```text
     - [ ] Build user session endpoint
       - Criteria: Returns HTTP 200 with JWT on valid credentials; returns HTTP 401 on bad password; unit test passes.
     ```

3. **Thymer Record Integration:**
   - Attach tasks as child line items directly under the parent project record using native Crockford GUID references.
   - Use status markers (`waiting`, `in_progress`, `done`).

4. **Client Review Checkpoints:**
   - At the conclusion of every milestone, insert a dedicated client review checkpoint:
     ```text
     - [ ] Milestone Staging Sign-Off (Client Checkpoint)
       - Criteria: Deployed to staging environment, Loom walkthrough recorded, written client approval received.
     ```
