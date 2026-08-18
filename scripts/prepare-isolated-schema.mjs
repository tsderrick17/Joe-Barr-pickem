import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const legacyDirectory = resolve("supabase");
const migrationsDirectory = resolve("supabase/migrations");
const bootstrapMigration = resolve(
  migrationsDirectory,
  "20260726000000_initialize_isolated_schema.sql",
);

// These files either schedule calls to the live Vercel deployment, replay one
// production player's picks, or only report production automation health.
// They must never be part of an isolated test database bootstrap.
const excludedLegacyFiles = new Set([
  "019_schedule_final_score_refresh.sql",
  "020_schedule_daily_nfl_refresh.sql",
  "021_schedule_official_line_locking.sql",
  "032_restore_tyler_week_1_ats.sql",
  "034_schedule_prelock_spread_refresh.sql",
  "039_add_automation_preflight.sql",
]);

const legacyFiles = Array.from({ length: 42 }, (_, index) =>
  `${String(index + 1).padStart(3, "0")}_${[
    "create_players",
    "create_seasons_and_scoring_periods",
    "create_teams",
    "create_games",
    "create_spreads",
    "create_picks",
    "create_survivor",
    "create_audit_logs",
    "create_sync_runs",
    "add_player_profile_policy",
    "seed_2026_season",
    "seed_nfl_teams",
    "add_scoring_period_dates",
    "enforce_week_integrity",
    "add_schedule_read_policies",
    "enforce_pick_integrity",
    "allow_pick_changes_until_kickoff",
    "store_player_pins",
    "schedule_final_score_refresh",
    "schedule_daily_nfl_refresh",
    "schedule_official_line_locking",
    "add_line_lock_sync_runs",
    "freeze_completed_scoring_periods",
    "add_runtime_query_indexes",
    "store_game_finalization_times",
    "replace_unlocked_picks_atomically",
    "add_survivor_pick_integrity",
    "save_slate_selections_atomically",
    "harden_survivor_and_audit_history",
    "separate_ats_and_survivor_audits",
    "fix_unlocked_pick_revisions",
    "restore_tyler_week_1_ats",
    "repair_completed_change_delete_guards",
    "schedule_prelock_spread_refresh",
    "restore_mode_specific_audits",
    "harden_scoring_period_continuity",
    "add_automation_execution_leases",
    "finalize_games_atomically",
    "add_automation_preflight",
    "void_disrupted_game_picks",
    "record_game_disruptions_atomically",
    "repair_disrupted_pick_voiding",
  ][index]}.sql`,
);

const extensionPrelude = `-- Generated only for the isolated Supabase project.\n-- No production data, Vault secrets, or cron jobs are copied.\n-- Supabase provisions cron, net, and vault schemas itself; this bootstrap only\n-- enables the UUID helpers the application schema owns.\ncreate extension if not exists pgcrypto with schema extensions;\ncreate extension if not exists "uuid-ossp" with schema extensions;\n`;

const legacySql = await Promise.all(
  legacyFiles
    .filter((file) => !excludedLegacyFiles.has(file))
    .map(async (file) => `\n-- Source: supabase/${file}\n${await readFile(resolve(legacyDirectory, file), "utf8")}`),
);

await rm(bootstrapMigration, { force: true });
await writeFile(bootstrapMigration, `${extensionPrelude}${legacySql.join("\n")}`);

// The historical migration includes one production-targeted reminder cron job.
// Preserve its tables/functions while removing just the scheduling statement.
const pushReminderMigration = resolve(
  migrationsDirectory,
  "20260728004000_add_push_reminder_system.sql",
);
const pushReminderSql = await readFile(pushReminderMigration, "utf8");
const scheduleStart = pushReminderSql.indexOf(
  "-- A five-minute check makes Commissioner-selected times flexible",
);
const preflightStart = pushReminderSql.indexOf(
  "create or replace function public.automation_preflight()",
);
const sanitizedPushReminderSql =
  scheduleStart >= 0 && preflightStart > scheduleStart
    ? `${pushReminderSql.slice(0, scheduleStart)}-- Isolated test databases never schedule requests to the live deployment.\n\n${pushReminderSql.slice(preflightStart)}`
    : pushReminderSql;

if (
  sanitizedPushReminderSql === pushReminderSql &&
  !pushReminderSql.includes("-- Isolated test databases never schedule requests to the live deployment.")
) {
  throw new Error("Could not remove the production reminder cron schedule.");
}

await writeFile(pushReminderMigration, sanitizedPushReminderSql);

// Keep the new alert and lease schema in isolated tests, but never install the
// production-facing preseason bootstrap or watchdog schedules there.
const operationsMigration = resolve(
  migrationsDirectory,
  "20260809010000_add_schedule_bootstrap_and_watchdog.sql",
);
const operationsSql = await readFile(operationsMigration, "utf8");
const operationsScheduleStart = operationsSql.indexOf(
  "-- The NFL schedule is normally complete well before August.",
);
const operationsPreflightStart = operationsSql.indexOf(
  "create or replace function public.automation_preflight()",
);
const sanitizedOperationsSql =
  operationsScheduleStart >= 0 && operationsPreflightStart > operationsScheduleStart
    ? `${operationsSql.slice(0, operationsScheduleStart)}-- Isolated test databases never schedule requests to the live deployment.\n\n${operationsSql.slice(operationsPreflightStart)}`
    : operationsSql;

if (
  sanitizedOperationsSql === operationsSql &&
  !operationsSql.includes("-- Isolated test databases never schedule requests to the live deployment.")
) {
  throw new Error("Could not remove the production bootstrap and watchdog schedules.");
}

await writeFile(operationsMigration, sanitizedOperationsSql);

// The reproducibility migration must be exercised in isolation, but an
// isolated database must never schedule calls to the production deployment.
// Remove only the marked cron block and keep the stricter preflight functions.
const criticalAutomationMigration = resolve(
  migrationsDirectory,
  "20260818013000_rebuild_critical_automation.sql",
);
const criticalAutomationSql = await readFile(criticalAutomationMigration, "utf8");
const criticalScheduleStart = criticalAutomationSql.indexOf(
  "-- BEGIN PRODUCTION CRITICAL SCHEDULES",
);
const criticalScheduleEnd = criticalAutomationSql.indexOf(
  "-- END PRODUCTION CRITICAL SCHEDULES",
);
const sanitizedCriticalAutomationSql =
  criticalScheduleStart >= 0 && criticalScheduleEnd > criticalScheduleStart
    ? `${criticalAutomationSql.slice(0, criticalScheduleStart)}-- Isolated test databases never schedule requests to the live deployment.\n${criticalAutomationSql.slice(criticalScheduleEnd + "-- END PRODUCTION CRITICAL SCHEDULES".length)}`
    : criticalAutomationSql;

if (sanitizedCriticalAutomationSql === criticalAutomationSql) {
  throw new Error("Could not remove the production critical automation schedules.");
}

await writeFile(criticalAutomationMigration, sanitizedCriticalAutomationSql);
