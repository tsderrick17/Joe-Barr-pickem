/**
 * The pool advances one NFL season at a time. Keeping the configured year in
 * one place prevents a partial next-season update across player, commissioner,
 * rollover, and import workflows.
 */
export const CURRENT_SEASON_YEAR = 2026;
