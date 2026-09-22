-- Presentation only. Existing wording, delivery receipts and snapshots remain intact.
alter table public.reminder_templates
  add column if not exists image_options jsonb not null default '{"density":"compact"}'::jsonb
  constraint reminder_templates_image_options_valid check (
    jsonb_typeof(image_options) = 'object'
    and image_options->>'density' in ('compact', 'comfortable')
    and image_options ? 'density'
  );

comment on column public.reminder_templates.image_options is
  'Commissioner artwork preferences. Delivery embeds these in image URLs so later edits do not change sent email spacing.';
