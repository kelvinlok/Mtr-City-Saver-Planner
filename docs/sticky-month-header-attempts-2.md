# Sticky Month Header Bleed-Through Bug

## Bug Description

When scrolling down the calendar view, day-cell content (e.g. "Morning commute", "USE Definitely") bleeds through the gap above the sticky month header ("April 2026" / "May 2026" + weekday row). The content should be hidden behind the header as it scrolls past.

Visible in the ~16px gap between the summary strip and the stuck month header.

## Relevant Layout Structure

```
.app-shell                    (height: 100dvh; overflow: hidden)
  .summary-strip-wrapper      (flex-shrink: 0)
  .planner-grid-wrapper       (flex: 1; overflow: hidden)
    .planner-grid
      .calendar-scroll        (height: 100%; overflow-y: auto; padding: 16px 0)  ← scroll container
        .calendar-region      (display: grid; gap: 16px)
          .month              (no position/z-index)
            .month-sticky-header  (position: sticky; top: 0; z-index: 4)
            .calendar-grid        (position: relative; z-index: 1)
          .month
            .month-sticky-header
            .calendar-grid
          ...
```

## Key CSS (original)

```css
.calendar-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 16px 0;           /* ← 16px top padding on the scroll container */
}

.month-sticky-header {
  position: sticky;
  top: 0;                    /* ← sticks at top of scrollport */
  z-index: 4;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 12px 12px 0 0;
  padding: 16px 16px 6px;
  box-shadow: var(--shadow-sm);
}

.month .calendar-grid {
  position: relative;
  z-index: 1;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-top: none;
  border-radius: 0 0 12px 12px;
  padding: 6px 16px 16px;
  box-shadow: var(--shadow-sm);
}

.calendar-region {
  display: grid;
  gap: 16px;
}
```

## Root Cause Analysis

The scroll container `.calendar-scroll` has `padding: 16px 0`. With `position: sticky; top: 0` on the month headers, the browser resolves `top: 0` relative to the scroll container's content area (after padding), not the border edge. This creates a ~16px gap between the scroll container's visible top edge and where the sticky header actually sticks. Calendar grid content scrolling past the header remains visible in that padding zone.

Measured via JS:
- `scrollerTop` (border edge): 113.3px
- `headerTop` (when stuck): 129.3px
- Gap: ~16px (matches the padding-top)

## Attempt 1: Remove z-index from .calendar-grid

**Hypothesis:** The `z-index: 1` on `.month .calendar-grid` creates a stacking context that competes with the sticky header's `z-index: 4`, causing the grid to paint over the header.

**Change:**
```css
.month .calendar-grid {
  /* removed: z-index: 1; */
  position: relative;
  ...
}
```

**Result:** Did NOT fix the bug. The bleed-through is not a z-index/stacking issue — it's a layout issue where content is visible in the padding zone above the sticky header's stuck position. The z-index change was a red herring; the grid was never painting *over* the header, it was visible *above* it in the padding gap.

## Attempt 2: Move top padding from scroll container to inner content

**Hypothesis:** The `padding-top: 16px` on `.calendar-scroll` shifts the sticky `top: 0` position 16px below the scroll container's visible edge. Moving the padding to the inner `.calendar-region` element would eliminate the gap while preserving the visual spacing.

**Changes:**
```css
.calendar-scroll {
  padding: 0 0 16px;         /* was: 16px 0 — removed top padding */
}

.calendar-region {
  padding-top: 16px;         /* added — moved spacing here */
}
```

**Measurements after change:**
- Gap above header: ~0px (header sticks flush at scroll container top)
- Visually appeared fixed in screenshots at scrollTop=550 and scrollTop=750

**Result:** Appeared to fix the issue in my testing, but user reports it is still the same. Possible reasons:
1. The `padding-top: 16px` on `.calendar-region` may still allow content to be visible in that space as it scrolls — the padding is inside the scrollable area and content passes through it before going behind the sticky header.
2. The gap between months (`.calendar-region { gap: 16px }`) creates similar zones where content from one month's grid can be visible above the next month's sticky header during the transition.
3. There may be a browser-specific rendering difference not captured in my DevTools testing.

## Remaining Ideas (Not Yet Attempted)

### Idea A: Clip the scroll container
Add `clip-path` or use a wrapper with `overflow: hidden` that sits exactly at the scroll container's top edge, so any content in the padding zone is clipped.

### Idea B: Extend the sticky header upward
Use negative margin-top + extra padding-top on `.month-sticky-header` to make it physically taller and cover the gap:
```css
.month-sticky-header {
  position: sticky;
  top: -16px;
  margin-top: -16px;
  padding-top: 32px; /* 16px original + 16px to cover gap */
}
```
This would make the header extend into the padding zone and cover any content there.

### Idea C: Use a ::before pseudo-element as a scroll mask
Add a fixed/sticky pseudo-element on `.calendar-scroll` that covers the padding zone with the background color:
```css
.calendar-scroll::before {
  content: "";
  position: sticky;
  top: 0;
  display: block;
  height: 0;
  margin-top: -16px;
  padding-top: 16px;
  background: var(--bg);
  z-index: 5;
}
```

### Idea D: Remove all padding/gap and use margin on .month
Eliminate all spacing that creates scrollable zones above sticky headers. Use margin-bottom on each `.month` for spacing (margin collapses differently in scroll containers).

### Idea E: Rethink the sticky approach entirely
Instead of CSS `position: sticky`, use a fixed-position header outside the scroll container that updates its content (month name + weekdays) based on scroll position via JS/IntersectionObserver. This avoids the CSS sticky padding issue entirely but requires more JS.

## Status

All changes reverted. Codebase is back to original state.
