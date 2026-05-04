# Sticky Month Header — Attempts Summary

## Goal

Make the month header (e.g. "May 2026" + weekday row) stay visible at the top of the scroll area while scrolling through that month's days. When the next month scrolls up enough, its header should replace the previous one.

## Original Structure

```
.calendar-scroll          (overflow-y: auto — the scroll container on desktop)
  .calendar-region
    .month                (border-radius: 12px card with background + border)
      h2                  ("April 2026")
      .weekday-grid       (SUN MON TUE ...)
      .calendar-grid      (day cells)
```

On mobile (≤1120px), `.calendar-scroll` becomes `overflow-y: visible` and the page body scrolls instead.

---

## Attempt 1 — `position: sticky` on h2 inside `.month`

**What was done:**
- Added `position: sticky; top: 0; z-index: 4; background: var(--surface)` to `.month h2`
- Adjusted `.month` padding from `16px` to `0 16px 16px` so the h2 sits at the top edge

**Result:** The h2 did stick, but the day cells (`.calendar-grid` children) painted on top of the sticky header as they scrolled past. The cells have `background: var(--surface)` and rendered after the h2 in DOM order, so they visually covered it.

---

## Attempt 2 — Wrap h2 + weekday-grid in `.month-sticky-header`

**What was done:**
- Created a wrapper `<div className="month-sticky-header">` around the h2 and weekday-grid in `CalendarView.tsx`
- Styled `.month-sticky-header` with `position: sticky; top: 0; z-index: 4; background: var(--surface); border-radius: 12px 12px 0 0`
- Made `.month` transparent with no padding (card styling split between sticky header and calendar-grid)
- Gave `.month .calendar-grid` its own background, border, and `border-radius: 0 0 12px 12px`

**Result:** Same visual problem — day cells still painted over the sticky header.

---

## Attempt 3 — Add `position: relative; z-index: 1` to `.calendar-grid`

**What was done:**
- Added `position: relative; z-index: 1` to `.month .calendar-grid` so it participates in the stacking context but at a lower z-index than the sticky header (z-index: 4)

**Result:** On desktop (tested via DevTools at full viewport), the sticky header appeared to work — "May 2026" stayed pinned and cells scrolled behind it. However, the user reported that on their actual device/viewport, cells were still scrolling on top of the header. The user's screenshot showed day cells clearly overlapping the month header from behind.

---

## Current State

- `CalendarView.tsx`: month structure is `<article class="month"> → <div class="month-sticky-header"> → h2 + weekday-grid</div> → <div class="calendar-grid"> → day cells</div></article>`
- CSS: `.month-sticky-header` has `position: sticky; top: 0; z-index: 4`, `.month .calendar-grid` has `position: relative; z-index: 1`
- The issue persists on the user's device — day cells paint over the sticky header

## Unresolved Root Cause

The likely root cause is one of:

1. **Stacking context isolation** — The `.month` article or an ancestor may be creating a stacking context that prevents the z-index from working as expected between siblings. CSS properties like `border-radius` combined with `overflow`, `transform`, `will-change`, or `filter` on ancestors can create implicit stacking contexts.

2. **`overflow: hidden` on ancestors** — If any ancestor between the sticky element and the scroll container has `overflow: hidden` or `overflow: auto`, it can break sticky positioning or clip the element.

3. **Mobile scroll container difference** — On mobile (≤1120px), the scroll container changes from `.calendar-scroll` to the page body. The sticky `top: 0` may need adjustment, or the mobile styles may override the sticky behavior.

4. **`box-shadow` on `.month-sticky-header`** — The `box-shadow: var(--shadow-sm)` may not be enough to visually separate the header, and the card split (header vs grid having separate borders) may cause visual artifacts.

## Possible Next Steps

- **Remove the card wrapper entirely** — Make months flat sections without the `.month` border/background card. Let the sticky header and calendar grid be direct children of `.calendar-region`. This avoids any stacking context issues from the `.month` parent.
- **Use JavaScript `IntersectionObserver`** — Detect when each month section enters/exits the viewport and manually position a fixed header overlay, bypassing CSS sticky entirely.
- **Add `isolation: isolate`** to `.month` to create an explicit stacking context, then ensure the sticky header's z-index is higher within that context.
