---
name: revision-limit-tracker
description: Enforces contractual revision rounds and flags scope creep before extra iterations in Thymer.
---

# Revision Limit Tracker

The **Revision Limit Tracker** safeguards design margins by strictly tracking client feedback iterations against the agreed Statement of Work (SOW) allowance (typically 2 included rounds).

## Core Directives

1. **Iteration Round Counter:**
   - Every design milestone must log which feedback cycle is currently executing:
     ```text
     - [ ] Round 1 Client Review (Completed 2026-10-15)
     - [ ] Round 2 Client Review — FINAL INCLUDED ROUND (In Progress)
     ```

2. **Scope Creep Warning at Limit:**
   - When Round 2 feedback is submitted, immediately notify the client:
     > "We have incorporated all notes for Round 2 (the final round included in our initial scope). Any subsequent rounds or fundamental layout pivots will be billed under our standard hourly revision rate (or Change Order)."

3. **Change Order Trigger:**
   - If the client requests additional modifications after Round 2 sign-off, draft an explicit Addendum or hourly Change Order before making any file changes.
