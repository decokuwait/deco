-- Additive-only. Focal point for a project photo, set from the admin panel.
--
-- Every gallery frame on every template is `object-cover`, so a photo is cropped to the frame and the
-- owner had no say in which part survived. On a decor portfolio the framing *is* the product: the
-- ceiling detail that got cut off is the job. Three positions cover the cases that matter, and NULL
-- keeps the behaviour every existing row already has (centre).
alter table project_media add column if not exists focal text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_media_focal_check') then
    alter table project_media add constraint project_media_focal_check
      check (focal is null or focal in ('top', 'center', 'bottom'));
  end if;
end $$;
