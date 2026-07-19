-- 自分の組織(とそこに紐づくevent_maps/map_categories/pins/pin_sessions/
-- organization_members)をまとめて削除する。event_maps以下はorganizationsへの
-- on delete cascadeで連鎖削除される。SECURITY DEFINERなのはorganizationsに
-- 直接のdeleteポリシーがなく(作成がRPC経由のみのため)、通常のクライアント権限
-- では削除できないことによる。auth.uid()で呼び出し本人の組織のみに限定する。
create or replace function delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from organizations
  where id in (
    select organization_id from organization_members where user_id = auth.uid()
  );
end;
$$;
