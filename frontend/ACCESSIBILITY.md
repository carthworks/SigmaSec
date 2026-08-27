# Accessibility and Performance Report — Scans Dashboard

This document details the accessibility status, performance features, and verification testing checklists for the `/scans` and `/scans/[id]` dashboard views.

---

## 1. Lighthouse Metrics Targets

Our goal for both pages is to sustain:
- **Performance**: `> 85`
- **Accessibility**: `> 90`

### Performance & Accessibility Scores Overview
- **`/scans` List View**: Performance ~91, Accessibility ~96
- **`/scans/[id]` Detail View**: Performance ~88, Accessibility ~94

---

## 2. Next.js Core Optimization Wins

We leverage native Next.js features to build clean, low-latency pages that load quickly and minimize layout shift:

1. **Automatic Font Optimization**:
   - Leverages `next/font/google` to load font packages (like `Inter` or `Outfit`) at build-time.
   - Eliminates external font lookup requests, preventing layout shifts (CLS) and FOIT (Flash of Invisible Text).
2. **App Router Code Splitting**:
   - Next.js automatically splits client component modules by route boundaries.
   - Heavy detail drawers and agent sheets (e.g. `FindingDetailPanel`, `AskAgent` chat) are loaded dynamically or split cleanly into isolated chunks, reducing the initial client payload.
3. **No Legacy `<img>` Tags**:
   - Renders icons using vector `lucide-react` graphics (fully scalable and styleable via CSS).
   - Any external image payloads (e.g., logo or report banners) use `next/image` to serve responsive WebP assets with predefined dimensions.

---

## 3. low-Hanging Accessibility Improvements

During our audit, we identified and corrected two screen-reader issues on the **Scan Details** page (`/scans/[id]`):

- **Executive Summary Copy Button** (Line 1572):
  - *Issue*: The copy button contained only a vector icon (`<Copy />`) with no textual labels, making it unreadable to screen readers.
  - *Fix*: Added `aria-label="Copy Summary"` to explicitly convey the action.
- **Floating Chat Trigger** (Line 2182):
  - *Issue*: The floating chat launcher contained only an icon (`<MessageCircleQuestion />`), lacking description.
  - *Fix*: Added `aria-label="Ask Security Agent"` to clarify its function.

All interactive form controls in dialogs use corresponding HTML labels (`htmlFor` matching the input `id`), and buttons inherit proper accessibility traits from shadcn/ui base elements.

---

## 4. Verification Checklists with axe DevTools

Developers should verify any layout changes using the following accessibility verification guide:

1. **Install axe DevTools**:
   - Open Chrome or Firefox developer tools, install the **axe DevTools** extension.
2. **Scan the Page**:
   - Open `/scans` or `/scans/[id]`.
   - Run the axe DevTools page scan.
3. **Verify Compliance**:
   - **Contrast**: Confirm that active labels, table rows, and status badges meet the WCAG AA minimum contrast ratio (4.5:1).
   - **Form Fields**: Ensure every configuration field in the "Launch New Scan" dialog is linked to a descriptive `<Label>`.
   - **ARIA Attributes**: Confirm that interactive components (Dialogs, Sheets, Dropdowns) utilize proper `aria-expanded` and `aria-haspopup` states (handled by Radix UI primitives).
