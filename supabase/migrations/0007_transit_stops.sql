-- 駅・バス停ピンの追加情報。1ピンにつき0または1件（1:1）。
create table pin_transit_stops (
  id              uuid primary key default gen_random_uuid(),
  pin_id          uuid not null unique references pins(id) on delete cascade,
  data_source     text not null check (data_source in ('gtfs', 'external_link')),

  -- data_source = 'external_link' のとき
  external_url    text,
  external_label  text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint pin_transit_stops_external_fields check (
    data_source <> 'external_link' or external_url is not null
  )
);

create index pin_transit_stops_pin_id_idx on pin_transit_stops (pin_id);

alter table pin_transit_stops enable row level security;

create policy pin_transit_stops_select on pin_transit_stops
  for select using (
    pin_id in (
      select id from pins where map_id in (
        select id from event_maps
        where status = 'published'
           or organization_id in (select organization_id from organization_members where user_id = auth.uid())
      )
    )
  );

create policy pin_transit_stops_write on pin_transit_stops
  for all using (
    pin_id in (
      select id from pins where map_id in (
        select id from event_maps
        where organization_id in (select organization_id from organization_members where user_id = auth.uid())
      )
    )
  ) with check (
    pin_id in (
      select id from pins where map_id in (
        select id from event_maps
        where organization_id in (select organization_id from organization_members where user_id = auth.uid())
      )
    )
  );

create trigger pin_transit_stops_set_updated_at
  before update on pin_transit_stops
  for each row execute function set_updated_at();
