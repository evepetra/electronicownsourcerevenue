# White background plan

## Goal
Make the e-OSR interface use a clean white background by default.

## Changes

1. **Pure white light theme in `src/styles.css`**
   - Set `--background` to `oklch(1 0 0)` (pure white) in `.light`.
   - Lighten `--card` to pure white and `--popover` to a very light gray so panels remain distinct.
   - Keep the existing dark theme unchanged.

2. **Default to light mode in `src/lib/theme.tsx`**
   - Change the initial `useState` from `"dark"` to `"light"`.
   - Keep the toggle and localStorage persistence so users can still switch back to dark.

3. **Visual verification**
   - Confirm the app shell, dashboard cards, and table surfaces render on white without contrast issues.
   - Check that borders and muted text remain readable on the lighter background.

## Outcome
First-time visitors and users who have not manually toggled theme will see a white background across the entire application. Dark mode remains available via the header toggle.
