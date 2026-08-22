-- 用户资料
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '新朋友',
  gender text not null default '',
  birth_date date,
  birth_time text not null default '',
  city text not null default '',
  bio text not null default '',
  avatar text not null default '🦊',
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "查看自己的资料" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "创建自己的资料" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "更新自己的资料" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, coalesce(new.raw_user_meta_data->>'nickname', '新朋友'));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- 测试结果
create table public.test_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id text not null,
  answers jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, test_id)
);
grant select, insert, update, delete on public.test_results to authenticated;
grant all on public.test_results to service_role;
alter table public.test_results enable row level security;
create policy "查看自己的测试结果" on public.test_results for select to authenticated using (auth.uid() = user_id);
create policy "保存自己的测试结果" on public.test_results for insert to authenticated with check (auth.uid() = user_id);
create policy "更新自己的测试结果" on public.test_results for update to authenticated using (auth.uid() = user_id);
create policy "删除自己的测试结果" on public.test_results for delete to authenticated using (auth.uid() = user_id);

-- 个人说明书
create table public.user_manuals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.user_manuals to authenticated;
grant all on public.user_manuals to service_role;
alter table public.user_manuals enable row level security;
create policy "查看自己的说明书" on public.user_manuals for select to authenticated using (auth.uid() = user_id);
create policy "创建自己的说明书" on public.user_manuals for insert to authenticated with check (auth.uid() = user_id);
create policy "更新自己的说明书" on public.user_manuals for update to authenticated using (auth.uid() = user_id);
create trigger user_manuals_touch before update on public.user_manuals for each row execute function public.touch_updated_at();

-- AI 体验官
create table public.personas (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  gender text not null,
  age int not null,
  city text not null,
  avatar text not null,
  tagline text not null default '',
  tags jsonb not null default '[]'::jsonb,
  manual jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.personas to authenticated;
grant all on public.personas to service_role;
alter table public.personas enable row level security;
create policy "登录用户可浏览体验官" on public.personas for select to authenticated using (true);

-- 匹配
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete cascade,
  matched_user_id uuid references auth.users(id) on delete cascade,
  score int not null default 0,
  highlights jsonb not null default '[]'::jsonb,
  relationship_manual jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  check (persona_id is not null or matched_user_id is not null)
);
grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "查看自己的匹配" on public.matches for select to authenticated using (auth.uid() = user_id or auth.uid() = matched_user_id);
create policy "创建自己的匹配" on public.matches for insert to authenticated with check (auth.uid() = user_id);
create policy "更新自己的匹配" on public.matches for update to authenticated using (auth.uid() = user_id or auth.uid() = matched_user_id);
create policy "删除自己的匹配" on public.matches for delete to authenticated using (auth.uid() = user_id);

create policy "匹配成功可互看资料" on public.profiles for select to authenticated
  using (exists (
    select 1 from public.matches m
    where (m.user_id = auth.uid() and m.matched_user_id = profiles.id)
       or (m.matched_user_id = auth.uid() and m.user_id = profiles.id)
  ));

-- AI军师对话线程
create table public.counselor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '新对话',
  context_type text not null default 'general',
  match_id uuid references public.matches(id) on delete set null,
  situation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.counselor_threads to authenticated;
grant all on public.counselor_threads to service_role;
alter table public.counselor_threads enable row level security;
create policy "查看自己的对话" on public.counselor_threads for select to authenticated using (auth.uid() = user_id);
create policy "创建自己的对话" on public.counselor_threads for insert to authenticated with check (auth.uid() = user_id);
create policy "更新自己的对话" on public.counselor_threads for update to authenticated using (auth.uid() = user_id);
create policy "删除自己的对话" on public.counselor_threads for delete to authenticated using (auth.uid() = user_id);
create trigger counselor_threads_touch before update on public.counselor_threads for each row execute function public.touch_updated_at();

-- AI军师消息
create table public.counselor_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.counselor_threads(id) on delete cascade,
  role text not null,
  parts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.counselor_messages to authenticated;
grant all on public.counselor_messages to service_role;
alter table public.counselor_messages enable row level security;
create policy "查看自己对话的消息" on public.counselor_messages for select to authenticated
  using (exists (select 1 from public.counselor_threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "写入自己对话的消息" on public.counselor_messages for insert to authenticated
  with check (exists (select 1 from public.counselor_threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "删除自己对话的消息" on public.counselor_messages for delete to authenticated
  using (exists (select 1 from public.counselor_threads t where t.id = thread_id and t.user_id = auth.uid()));

insert into public.personas (nickname, gender, age, city, avatar, tagline, tags, manual) values
('林小满', '女', 26, '杭州', '🦌', '想把每一天都过成周末', '["看展","citywalk","养猫","胶片摄影"]', '{"mbti":"ENFP","element":"火象","zodiac":"射手座","attachment":"安全型","loveLanguage":"肯定的言语","needs":"高需求","oneLiner":"热情外放的小太阳，喜欢把快乐传染给身边的人","strengths":["共情力强","行动力满分","气氛担当"],"growth":["偶尔三分钟热度","需要练习慢下来"],"values":["自由","真诚","新鲜感"],"hobbies":["看展","citywalk","养猫"],"idealMatch":"能接住她的热情，也能陪她安静发呆的人"}'),
('沈亦舟', '男', 28, '上海', '🐋', '理性外壳，温柔内核', '["手冲咖啡","攀岩","纪录片","爵士乐"]', '{"mbti":"INTJ","element":"水象","zodiac":"天蝎座","attachment":"疏离偏安全","loveLanguage":"服务的行动","needs":"低需求","oneLiner":"话不多但靠谱，习惯用行动表达在乎","strengths":["情绪稳定","说到做到","规划力强"],"growth":["不太会主动表达","容易把心事藏起来"],"values":["深度","边界感","长期主义"],"hobbies":["手冲咖啡","攀岩","纪录片"],"idealMatch":"能读懂他的沉默，愿意慢慢靠近的人"}'),
('苏晚星', '女', 24, '成都', '🐰', '浪漫主义的实践派', '["手账","livehouse","烘焙","塔罗"]', '{"mbti":"INFP","element":"水象","zodiac":"双鱼座","attachment":"焦虑型","loveLanguage":"精心的时刻","needs":"高需求","oneLiner":"内心住着一个童话世界，敏感又炽热","strengths":["细腻温柔","想象力丰富","很会爱人"],"growth":["容易想太多","安全感需要被反复确认"],"values":["浪漫","被理解","仪式感"],"hobbies":["手账","livehouse","烘焙"],"idealMatch":"情绪稳定、愿意给她确定感的人"}'),
('陆则明', '男', 30, '北京', '🦉', '山和海都在计划里', '["徒步","摄影","威士忌","历史"]', '{"mbti":"ENTJ","element":"土象","zodiac":"摩羯座","attachment":"安全型","loveLanguage":"高质量的陪伴","needs":"低需求","oneLiner":"目标感很强的行动派，温柔都藏在安排里","strengths":["可靠有担当","逻辑清晰","会照顾人"],"growth":["偶尔太讲道理","需要练习示弱"],"values":["成长","责任","效率"],"hobbies":["徒步","摄影","威士忌"],"idealMatch":"有自己热爱的事业，能并肩前行的人"}'),
('江晚舟', '女', 27, '广州', '🦊', '人间烟火收藏家', '["探店","瑜伽","音乐剧","插花"]', '{"mbti":"ESFJ","element":"土象","zodiac":"金牛座","attachment":"安全型","loveLanguage":"接收礼物","needs":"中需求","oneLiner":"把生活经营得有滋有味，朋友眼里的定心丸","strengths":["体贴周到","生活能力强","人缘好"],"growth":["偶尔委屈自己成全别人","不太会拒绝"],"values":["稳定","陪伴","烟火气"],"hobbies":["探店","瑜伽","音乐剧"],"idealMatch":"懂得珍惜她的付出，也把她的感受放在心上的人"}'),
('陈屿', '男', 25, '南京', '🐺', '快乐小狗，偶尔哲学家', '["飞盘","脱口秀","调酒","citypop"]', '{"mbti":"ENTP","element":"风象","zodiac":"双子座","attachment":"疏离型","loveLanguage":"身体接触","needs":"低需求","oneLiner":"点子王兼气氛组组长，独处时喜欢思考人生","strengths":["幽默风趣","脑洞大","适应力强"],"growth":["害怕被束缚","承诺需要慢慢来"],"values":["有趣","自由","真实"],"hobbies":["飞盘","脱口秀","调酒"],"idealMatch":"能跟他玩到一块，也给他留足空间的人"}');