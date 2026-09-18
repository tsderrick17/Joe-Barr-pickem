# PickemJB visual system

The site and its email artwork share a small set of visual rules. Keep future changes inside these primitives before introducing a page-specific value.

## Core tokens

- `--pool-paper` / `--pool-surface`: parchment page background and clean content surface.
- `--pool-ink` / `--pool-muted`: primary and supporting text.
- `--pool-teal`: official, healthy, and action state.
- `--pool-alert`: destructive or blocked state.
- `--pool-rule`: table and card boundaries.
- `--pool-display-font` / `--pool-body-font`: Georgia-style display type and compact Arial utility type.
- `--pool-space-1` through `--pool-space-3`: the shared compact spacing scale.
- `--pool-radius-sm`, `--pool-focus-ring`, and `--pool-control-height`: consistent interaction geometry.

## Layout contracts

- Matchup rows have equal team lanes around a dedicated line lane. Pregame rows may reclaim unused Survivor space; settled rows retain their score geometry.
- Dense tables scroll horizontally only when the viewport cannot fit the full matrix; they do not create incidental vertical scrollbars.
- Email artwork is rendered at a tighter canvas than desktop Slate artwork so iOS Mail does not shrink headings and team labels unnecessarily.
- Email images always have a link and descriptive fallback text. Dynamic artwork URLs are versioned and successful renders are cacheable.

## State styling

Use teal for official/healthy, amber for waiting, and red for blocked/error. Status should be communicated by text as well as color. Focus states use the shared ring rather than a page-specific outline.
