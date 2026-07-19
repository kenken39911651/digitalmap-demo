alter table event_maps
  add column hidden_schedule_venues text[] not null default '{}';
