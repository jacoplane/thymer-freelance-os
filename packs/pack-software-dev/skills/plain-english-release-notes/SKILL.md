---
name: plain-english-release-notes
description: Converts technical git commits, pull requests, and engineering tickets into client-friendly release notes, staging handoff digests, and testing instructions.
---

# Plain-English Release Generator

The **Plain-English Release Generator** bridges the communication divide between software developers and non-technical stakeholders.

## Core Rules

1. **Zero Technical Jargon:**
   - Instead of *"Refactored SQL query index for O(1) retrieval"*, write *"Accelerated client dashboard loading time by 60%"*.
   - Instead of *"Implemented JWT bearer middleware"*, write *"Added secure automated user session login"*.

2. **Standard 5-Section Handoff Structure:**
   Every release digest must follow this structure:
   - **Executive Summary:** One sentence capturing the core milestone achieved.
   - **What's New (Business Value):** Bullet points explaining what users can now do.
   - **Fixes & Polish:** Noticeable UI/UX or stability improvements.
   - **How to Test on Staging:** Staging URL, test credentials, and 2–3 specific steps for the client to verify.
   - **Next Up:** Clear preview of the upcoming sprint goals.

3. **Thymer Milestone Sign-Off:**
   - Links the release digest directly to the active Project and milestone record in Thymer.
   - Flags the Staging Checkpoint as ready for client review.
