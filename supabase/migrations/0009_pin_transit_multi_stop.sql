-- 1つのピンに複数のGTFS停留所(上り/下りなど)を紐付けられるようにし、
-- 各停留所ごとに表示する路線を絞り込めるようにする。
-- 旧来のpin_transit_stops.feed_id/gtfs_stop_id(1停留所のみ)は廃止する。
alter table pin_transit_stops
  drop constraint pin_transit_stops_source_fields,
  drop column feed_id,
  drop column gtfs_stop_id;

alter table pin_transit_stops add constraint pin_transit_stops_external_fields check (
  data_source <> 'external_link' or external_url is not null
);

create table pin_transit_gtfs_stops (
  id                  uuid primary key default gen_random_uuid(),
  pin_transit_stop_id uuid not null references pin_transit_stops(id) on delete cascade,
  feed_id             uuid not null references gtfs_feeds(id) on delete cascade,
  gtfs_stop_id        uuid not null references gtfs_stops(id) on delete cascade,
  created_at          timestamptz not null default now(),
  unique (pin_transit_stop_id, gtfs_stop_id)
);
create index pin_transit_gtfs_stops_parent_idx on pin_transit_gtfs_stops (pin_transit_stop_id);

-- この停留所で表示する路線を絞り込む。行が0件なら「全路線を表示」を意味する。
create table pin_transit_gtfs_routes (
  id                       uuid primary key default gen_random_uuid(),
  pin_transit_gtfs_stop_id uuid not null references pin_transit_gtfs_stops(id) on delete cascade,
  route_uuid               uuid not null references gtfs_routes(id) on delete cascade,
  unique (pin_transit_gtfs_stop_id, route_uuid)
);
create index pin_transit_gtfs_routes_parent_idx on pin_transit_gtfs_routes (pin_transit_gtfs_stop_id);

alter table pin_transit_gtfs_stops enable row level security;
alter table pin_transit_gtfs_routes enable row level security;

create policy pin_transit_gtfs_stops_select on pin_transit_gtfs_stops
  for select using (
    pin_transit_stop_id in (
      select id from pin_transit_stops where pin_id in (
        select id from pins where map_id in (
          select id from event_maps
          where status = 'published'
             or organization_id in (select organization_id from organization_members where user_id = auth.uid())
        )
      )
    )
  );

create policy pin_transit_gtfs_stops_write on pin_transit_gtfs_stops
  for all using (
    pin_transit_stop_id in (
      select id from pin_transit_stops where pin_id in (
        select id from pins where map_id in (
          select id from event_maps
          where organization_id in (select organization_id from organization_members where user_id = auth.uid())
        )
      )
    )
  ) with check (
    pin_transit_stop_id in (
      select id from pin_transit_stops where pin_id in (
        select id from pins where map_id in (
          select id from event_maps
          where organization_id in (select organization_id from organization_members where user_id = auth.uid())
        )
      )
    )
  );

create policy pin_transit_gtfs_routes_select on pin_transit_gtfs_routes
  for select using (
    pin_transit_gtfs_stop_id in (
      select id from pin_transit_gtfs_stops where pin_transit_stop_id in (
        select id from pin_transit_stops where pin_id in (
          select id from pins where map_id in (
            select id from event_maps
            where status = 'published'
               or organization_id in (select organization_id from organization_members where user_id = auth.uid())
          )
        )
      )
    )
  );

create policy pin_transit_gtfs_routes_write on pin_transit_gtfs_routes
  for all using (
    pin_transit_gtfs_stop_id in (
      select id from pin_transit_gtfs_stops where pin_transit_stop_id in (
        select id from pin_transit_stops where pin_id in (
          select id from pins where map_id in (
            select id from event_maps
            where organization_id in (select organization_id from organization_members where user_id = auth.uid())
          )
        )
      )
    )
  ) with check (
    pin_transit_gtfs_stop_id in (
      select id from pin_transit_gtfs_stops where pin_transit_stop_id in (
        select id from pin_transit_stops where pin_id in (
          select id from pins where map_id in (
            select id from event_maps
            where organization_id in (select organization_id from organization_members where user_id = auth.uid())
          )
        )
      )
    )
  );
