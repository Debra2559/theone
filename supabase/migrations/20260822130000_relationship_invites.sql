-- 好友关系报告邀请
create table public.relationship_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  inviter_nickname text not null default '一位朋友',
  inviter_avatar text not null default 'db:lorelei:Friend',
  invitee_user_id uuid references auth.users(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

grant select on public.relationship_invites to anon, authenticated;
grant insert, update on public.relationship_invites to authenticated;
grant all on public.relationship_invites to service_role;
alter table public.relationship_invites enable row level security;

create policy "查看邀请公开信息" on public.relationship_invites
  for select to anon, authenticated using (true);
create policy "创建自己的邀请" on public.relationship_invites
  for insert to authenticated with check (auth.uid() = inviter_user_id);
create policy "更新自己的邀请" on public.relationship_invites
  for update to authenticated using (auth.uid() = inviter_user_id or auth.uid() = invitee_user_id);
create policy "接受待处理邀请" on public.relationship_invites
  for update to authenticated
  using (status = 'pending')
  with check (auth.uid() = invitee_user_id);

create index relationship_invites_token_idx on public.relationship_invites(token);

-- 关系报告需要读取双方已经完成的测试与说明书；仅限已创建匹配的双方。
create policy "匹配双方可互看测试结果" on public.test_results
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.matches m
      where (m.user_id = auth.uid() and m.matched_user_id = test_results.user_id)
         or (m.matched_user_id = auth.uid() and m.user_id = test_results.user_id)
    )
  );

create policy "匹配双方可互看说明书" on public.user_manuals
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.matches m
      where (m.user_id = auth.uid() and m.matched_user_id = user_manuals.user_id)
         or (m.matched_user_id = auth.uid() and m.user_id = user_manuals.user_id)
    )
  );
