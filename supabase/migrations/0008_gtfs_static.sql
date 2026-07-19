-- GTFS静的データ(時刻表)の取り込み。gtfs_feedsは組織所有データ。
-- gtfs_stops以下は事業者が元々公開しているオープンデータのキャッシュなので、
-- 読み込みは誰でも可・書き込みは登録した組織のみ、というRLSにする。
create table gtfs_feeds (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  name              text not null,
  source_url        text not null,
  status            text not null default 'pending'
                       check (status in ('pending', 'stops_ready', 'ready', 'error')),
  last_imported_at  timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index gtfs_feeds_organization_id_idx on gtfs_feeds (organization_id);

alter table gtfs_feeds enable row level security;
create policy gtfs_feeds_select on gtfs_feeds
  for select using (organization_id in (select organization_id from organization_members where user_id = auth.uid()));
create policy gtfs_feeds_write on gtfs_feeds
  for all using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create trigger gtfs_feeds_set_updated_at
  before update on gtfs_feeds
  for each row execute function set_updated_at();

create table gtfs_stops (
  id              uuid primary key default gen_random_uuid(),
  feed_id         uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  stop_id         text not null,
  stop_name       text not null,
  stop_lat        double precision,
  stop_lon        double precision,
  unique (feed_id, stop_id)
);
create index gtfs_stops_feed_id_idx on gtfs_stops (feed_id);

create table gtfs_routes (
  id                uuid primary key default gen_random_uuid(),
  feed_id           uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id   uuid not null references organizations(id) on delete cascade,
  route_id          text not null,
  route_short_name  text,
  route_long_name   text,
  unique (feed_id, route_id)
);
create index gtfs_routes_feed_id_idx on gtfs_routes (feed_id);

create table gtfs_trips (
  id              uuid primary key default gen_random_uuid(),
  feed_id         uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  trip_id         text not null,
  route_uuid      uuid not null references gtfs_routes(id) on delete cascade,
  service_id      text not null,
  trip_headsign   text,
  unique (feed_id, trip_id)
);
create index gtfs_trips_feed_id_idx on gtfs_trips (feed_id);
create index gtfs_trips_route_uuid_idx on gtfs_trips (route_uuid);

create table gtfs_stop_times (
  id              uuid primary key default gen_random_uuid(),
  feed_id         uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  trip_uuid       uuid not null references gtfs_trips(id) on delete cascade,
  stop_uuid       uuid not null references gtfs_stops(id) on delete cascade,
  stop_sequence   int not null,
  -- GTFS生の"HH:MM:SS"文字列のまま保持する(25:xx等の翌日表記があるため、time型にしない)
  arrival_time    text,
  departure_time  text,
  unique (feed_id, trip_uuid, stop_sequence)
);
create index gtfs_stop_times_stop_uuid_idx on gtfs_stop_times (stop_uuid, departure_time);

create table gtfs_calendar (
  id              uuid primary key default gen_random_uuid(),
  feed_id         uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id      text not null,
  monday boolean not null default false,
  tuesday boolean not null default false,
  wednesday boolean not null default false,
  thursday boolean not null default false,
  friday boolean not null default false,
  saturday boolean not null default false,
  sunday boolean not null default false,
  start_date date not null,
  end_date date not null,
  unique (feed_id, service_id)
);

create table gtfs_calendar_dates (
  id              uuid primary key default gen_random_uuid(),
  feed_id         uuid not null references gtfs_feeds(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  service_id      text not null,
  date            date not null,
  exception_type  smallint not null
);
create index gtfs_calendar_dates_lookup_idx on gtfs_calendar_dates (feed_id, service_id, date);

alter table gtfs_stops enable row level security;
alter table gtfs_routes enable row level security;
alter table gtfs_trips enable row level security;
alter table gtfs_stop_times enable row level security;
alter table gtfs_calendar enable row level security;
alter table gtfs_calendar_dates enable row level security;

create policy gtfs_stops_select on gtfs_stops for select using (true);
create policy gtfs_stops_write on gtfs_stops for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy gtfs_routes_select on gtfs_routes for select using (true);
create policy gtfs_routes_write on gtfs_routes for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy gtfs_trips_select on gtfs_trips for select using (true);
create policy gtfs_trips_write on gtfs_trips for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy gtfs_stop_times_select on gtfs_stop_times for select using (true);
create policy gtfs_stop_times_write on gtfs_stop_times for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy gtfs_calendar_select on gtfs_calendar for select using (true);
create policy gtfs_calendar_write on gtfs_calendar for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

create policy gtfs_calendar_dates_select on gtfs_calendar_dates for select using (true);
create policy gtfs_calendar_dates_write on gtfs_calendar_dates for all
  using (organization_id in (select organization_id from organization_members where user_id = auth.uid()))
  with check (organization_id in (select organization_id from organization_members where user_id = auth.uid()));

alter table pin_transit_stops
  add column feed_id uuid references gtfs_feeds(id) on delete set null,
  add column gtfs_stop_id uuid references gtfs_stops(id) on delete set null;

alter table pin_transit_stops drop constraint pin_transit_stops_external_fields;
alter table pin_transit_stops add constraint pin_transit_stops_source_fields check (
  (data_source = 'external_link' and external_url is not null)
  or
  (data_source = 'gtfs' and feed_id is not null and gtfs_stop_id is not null)
);
