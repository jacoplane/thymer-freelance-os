---
name: asset-handoff-checklist
description: Generates structured delivery manifests (SVG, PNG, design tokens, fonts, specs) for client sign-off in Thymer.
---

# Asset Handoff Checklist

The **Asset Handoff Checklist** ensures zero-confusion file delivery, creating clear delivery manifests for engineering teams or marketing clients upon project completion.

## Core Directives

1. **Multi-Format Export Manifest:**
   - Specify exact deliverables:
     - Vectors: Optimized SVG, EPS, PDF (CMYK for print).
     - Rasters: 1x, 2x, 3x WebP/PNG with alpha transparency.
     - Typography: Webfont licenses and Google Fonts pairings.
     - Design Tokens: JSON/CSS custom properties for colors, spacing, and typography.

2. **Handoff Verification Checkpoint:**
   - Insert a native client sign-off task in Thymer:
     ```text
     - [ ] Asset Pack Handoff Verification
       - Criteria: Google Drive/Dropbox shared with view/edit access; test download verified; written acceptance received from client.
     ```
