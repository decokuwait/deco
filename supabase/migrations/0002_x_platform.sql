-- Adds X (Twitter) as a marketing platform.
alter table pixels drop constraint if exists pixels_platform_check;
alter table pixels add constraint pixels_platform_check check (platform in ('meta','tiktok','snapchat','google','x'));
