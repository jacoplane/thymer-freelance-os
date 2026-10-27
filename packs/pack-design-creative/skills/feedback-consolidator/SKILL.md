---
name: feedback-consolidator
description: Aggregates scattered Figma, email, and chat comments into prioritized, conflict-free design revisions in Thymer.
---

# Feedback Consolidator

The **Feedback Consolidator** eliminates chaotic client feedback by ingesting comments scattered across Figma pins, email threads, and Slack messages and converting them into a single, unified, de-duplicated revision checklist in Thymer.

## Core Directives

1. **Conflict Resolution:**
   - If Stakeholder A asks for "more whitespace" and Stakeholder B asks to "fit everything above the fold", flag the contradiction explicitly and require a single internal client owner to reconcile.

2. **Actionable Checklist Hierarchy:**
   - Categorize comments into:
     - **P0 Blockers:** Broken hierarchy, accessibility/contrast failures, brand guide violations.
     - **P1 Content & Copy:** Typos, updated photography, revised headline lengths.
     - **P2 Subjective Preferences:** "Make it pop", minor aesthetic polish.

3. **Thymer Log Entry:**
   - Insert the consolidated review checklist under the project's **Client Communication & Decisions** section with timestamps.
