-- ============================================================
-- theone 数据库初始化（修复版 v2，适配全新 Supabase 项目）
-- 可重复执行：每次都会先清空旧表再重建
-- 演示账号：tenghuijin@163.com / 密码 Demo123456
-- ============================================================

-- ---------- 0. 清理旧对象（保证可重复执行） ----------
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.counselor_messages cascade;
drop table if exists public.counselor_threads cascade;
drop table if exists public.matches cascade;
drop table if exists public.user_manuals cascade;
drop table if exists public.test_results cascade;
drop table if exists public.personas cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user();
drop function if exists public.touch_updated_at();

-- ---------- 1. 基础表结构（migration 062414） ----------
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
-- ---------- 2. 函数权限收紧（migration 062436） ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

-- ---------- 3. 创建演示账号（种子数据的外键依赖） ----------
-- 原种子数据写死了这个 user_id，新项目里不存在，这里手动补建
-- 登录方式：tenghuijin@163.com / Demo123456
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1',
  'authenticated', 'authenticated',
  'tenghuijin@163.com',
  extensions.crypt('Demo123456', extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nickname":"演示用户"}'::jsonb
) on conflict (id) do nothing;

insert into auth.identities (
  id, provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(),
       '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1',
       '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1',
       'email',
       '{"sub":"098ecf7a-7391-41fc-bb9e-a7a5c3d617c1","email":"tenghuijin@163.com","email_verified":true}'::jsonb,
       now(), now(), now()
where not exists (
  select 1 from auth.identities where user_id = '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1'
);
-- 重跑保险：若 profile 缺失（比如演示用户早已存在、触发器未触发），手动补一条
insert into public.profiles (id, nickname, avatar)
values ('098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', '演示用户', 'db:adventurer:Mochi0')
on conflict (id) do nothing;

-- 补空字符串：Auth 服务要求 token 类文本列不能为 NULL（否则登录报
-- "Database error querying schema"，Supabase 官方文档有记载）
update auth.users set
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  reauthentication_token      = coalesce(reauthentication_token, ''),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, ''),
  phone                       = coalesce(phone, '')
where id = '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1';

-- ---------- 4. 头像字段更新（migration 074652 / 075146，原库随机 UUID 在新库为空转） ----------
UPDATE personas SET avatar = 'db:lorelei:Xiaoman' WHERE id = '55022ed5-2400-42c2-b379-1e04a1d22757';
UPDATE personas SET avatar = 'db:micah:Yizhou' WHERE id = '8e3a42d5-8df1-4df7-b66e-9b1588141d84';
UPDATE personas SET avatar = 'db:adventurer:Wanxing' WHERE id = '9b97550c-3947-41ea-b417-c810274d0a7f';
UPDATE personas SET avatar = 'db:adventurer:Zeming' WHERE id = 'cdff517b-5c5d-4850-b6f2-fb2711589eaa';
UPDATE personas SET avatar = 'db:big-smile:Wanzhou' WHERE id = '8483a33e-fcd1-4811-972b-b0278bba179f';
UPDATE personas SET avatar = 'db:micah:Chenyu' WHERE id = 'c6aa0069-eb22-465b-8922-0bdc25a75670';
UPDATE profiles SET avatar = 'db:adventurer:Mochi0'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tenghuijin@163.com');UPDATE personas SET avatar = 'db:lorelei:XM1' WHERE id = '55022ed5-2400-42c2-b379-1e04a1d22757';
UPDATE personas SET avatar = 'db:micah:CY2' WHERE id = 'cdff517b-5c5d-4850-b6f2-fb2711589eaa';
UPDATE personas SET avatar = 'db:micah:CY6' WHERE id = 'c6aa0069-eb22-465b-8922-0bdc25a75670';

-- ---------- 5. 补建演示匹配记录（migration 080615 的线程引用了它） ----------
-- 该 match 在后续 081500 迁移中会被清理，这里只为满足外键
insert into public.matches (id, user_id, persona_id, score, highlights, status)
select '8c37165b-f9a9-4261-aad8-f12adb83a781',
       '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1',
       p.id, 85, '["演示数据"]'::jsonb, 'liked'
from public.personas p where p.nickname = '苏晚星';

-- ---------- 6. 演示账号的军师对话种子（migration 080615） ----------
-- Seed realistic counselor demo threads for the demo account (tenghuijin@163.com)
DO $$
DECLARE
  demo_user uuid := '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1';
  match_id uuid := '8c37165b-f9a9-4261-aad8-f12adb83a781';
  t1 uuid := '11111111-1111-4111-8111-111111111111';
  t2 uuid := '22222222-2222-4222-8222-222222222222';
  t3 uuid := '33333333-3333-4333-8333-333333333333';
BEGIN
  -- Clean re-seed
  DELETE FROM public.counselor_threads WHERE id IN (t1, t2, t3);

  -- Thread 1: about matched persona 苏晚星
  INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation, created_at, updated_at)
  VALUES (t1, demo_user, '要不要约晚星周末见面', 'match', match_id,
    '和苏晚星匹配后聊了五天，从电影聊到咖啡，她回复很积极但都是我在找话题。关系说明书说我们「节奏互补」，我不知道现在提见面会不会太快。',
    now() - interval '1 day 6 hours', now() - interval '5 hours');

  INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
    (t1, 'user', '[{"type":"text","text":"军师，我和晚星聊了五天了，每天都是我先开口。她回复挺快的，也会反问，但我有点拿不准——现在约她周末出来喝咖啡，会不会显得太急？"}]'::jsonb, now() - interval '1 day 6 hours'),
    (t1, 'assistant', '[{"type":"text","text":"先看看你们的底牌再下注。\n\n你们的关系说明书里写着「节奏互补」：你是想到就做的行动派，她是需要先确认安全感再迈步子的人。她回复快、会反问，这在她的性格底色里已经是很明确的绿灯了——浪漫主义的实践派，对没兴趣的人是惜字如金的。\n\n至于「总是你先开口」，别急着扣分。她的说明书里高需求维度偏向「被带领」，五天都接得住你的话题，说明她在等你把节奏带起来。\n\n所以答案是：可以约，但约法有讲究。"}]'::jsonb, now() - interval '1 day 5 hours'),
    (t1, 'user', '[{"type":"text","text":"怎么说？我怕约得太正式她有压力。"}]'::jsonb, now() - interval '1 day 4 hours'),
    (t1, 'assistant', '[{"type":"text","text":"对，「正式的邀约」才是雷区，见面本身不是。给你三个要点：\n\n1. 用你们聊过的事做钩子。你们聊过咖啡，就直接说「你上次说那家手冲店，周六下午我去探店，要不要一起踩个点」——是顺路的邀请，不是郑重的约会。\n\n2. 给一个具体的、短的时间框。下午两三个小时，比「周末有空吗」好接一百倍。\n\n3. 留一个体面的台阶。结尾加一句「要是这周忙就改天」，她这种性格需要确认自己有选择权。\n\n台阶不是示弱，是让她答应得更痛快。去吧，这局胜率我看在七成以上。"}]'::jsonb, now() - interval '1 day 3 hours'),
    (t1, 'user', '[{"type":"text","text":"成了！她答应了，还主动说想见见我说的那家店。周六下午有什么要注意的吗？"}]'::jsonb, now() - interval '6 hours'),
    (t1, 'assistant', '[{"type":"text","text":"漂亮，这步走得干净利落。第一次见面记住三件事：\n\n一，早到十分钟，把座位选在靠窗、光线好的位置。她对你还不熟，明亮开阔的环境能让她放松。\n\n二，准备两个她聊过的话题做存档，冷场时取用——比如她提过的那部老电影。但别像背稿子，聊开了就扔掉。\n\n三，结束时别拖。两个半小时左右主动收尾，说一句「今天很开心，路上小心」。第一次见面最好的状态是让她觉得意犹未尽，而不是电量耗尽。\n\n周六晚上记得回来汇报战况，我等你。"}]'::jsonb, now() - interval '5 hours');

  -- Thread 2: external relationship
  INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation, created_at, updated_at)
  VALUES (t2, demo_user, 'TA 回复越来越慢了', 'external', NULL,
    '朋友聚会上认识的，加微信三周了。前两周每天都能聊到半夜，这周开始隔好几个小时才回，语气也变短了。约了两次都说最近忙。',
    now() - interval '3 days', now() - interval '1 day 2 hours');

  INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
    (t2, 'user', '[{"type":"text","text":"军师，TA 最近回复越来越慢，昨天发的消息到今天中午才回了三个字。是不是对我没兴趣了？我要不要直接问清楚？"}]'::jsonb, now() - interval '3 days'),
    (t2, 'assistant', '[{"type":"text","text":"先别急着下结论，也别急着去问。「是不是没兴趣了」这个问题直接抛出去，得到的只会是客套话，还把氛围搞僵了。\n\n回复变慢有三种常见原因：一，真的忙；二，热度在自然回落；三，有别人出现了。从「能聊到半夜」掉到「三个字」，更像第二种——新鲜感期过了，进入平淡期。\n\n这不等于没戏，但意味着原来的相处模式撑不下去了。天天聊到半夜本来就不可能持久，那只是烟花，不是炉火。"}]'::jsonb, now() - interval '3 days' + interval '4 minutes'),
    (t2, 'user', '[{"type":"text","text":"那我现在该怎么办？继续找话题硬聊吗？"}]'::jsonb, now() - interval '2 days 20 hours'),
    (t2, 'assistant', '[{"type":"text","text":"不硬聊，改用「低频高质量」策略：\n\n1. 把每天打卡式的聊天降到两三天一次，每次发有内容的东西——你看到的一家的展览、一首歌、一件和你俩共同记忆有关的小事。\n\n2. 两周内约一次具体的线下见面。文字聊天已经带不动关系了，得靠真实的相处重新加热。\n\n3. 最重要的一点：把省下来的精力放回自己身上。你的说明书里写着你是高需求型，越是焦虑地盯着回复速度，越容易发出让对方有压力的信号。\n\n如果约线下还是推第三次，那时候再考虑体面退场也不迟。"}]'::jsonb, now() - interval '2 days 18 hours'),
    (t2, 'user', '[{"type":"text","text":"嗯……你说得对，我最近确实有点患得患失。我按你说的试试，约了 TA 下周四去看展。"}]'::jsonb, now() - interval '1 day 4 hours'),
    (t2, 'assistant', '[{"type":"text","text":"这就对了，行动力在线。\n\n看展是个聪明的选择：并肩走着看东西，比面对面坐着吃饭压力小，话题也天然不断。\n\n那天记住一个原则——你是去看展的，顺便和 TA 一起。心态上把自己当主人，别当等待宣判的人。看完展可以在附近随便吃点什么，不刻意安排「正式晚餐」。\n\n周四之后来跟我说说感觉，我们再定下一步。稳住，你比你想象中更有魅力。"}]'::jsonb, now() - interval '1 day 2 hours');

  -- Thread 3: self understanding
  INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation, created_at, updated_at)
  VALUES (t3, demo_user, '高需求+火象，我是不是太粘人了', 'self', NULL,
    '测试结果显示我是高需求型、火象星座特质很重。上一段感情就因为我总想黏着对方分手了，想知道怎么和自己的需求相处。',
    now() - interval '5 days', now() - interval '4 days');

  INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
    (t3, 'user', '[{"type":"text","text":"军师，我的说明书说我是「高需求+火象」，想到什么就要马上表达，对方一冷淡我就焦虑。上一段感情就是这么搞砸的。我是不是应该改一改，学着冷淡一点？"}]'::jsonb, now() - interval '5 days'),
    (t3, 'assistant', '[{"type":"text","text":"先说结论：不需要改成一个冷淡的人，那等于叫火别发光。\n\n高需求不是缺陷，它只是一种能量规格。你的问题从来不是「需求太多」，而是「所有需求都压在一个人身上」。任何电源只接一个电器，都会烧。\n\n真正要做的是分流：把表达欲分给朋友、分给创作、分给运动，留最精华的那部分给喜欢的人。火象的热烈用在关键时刻是浪漫，24 小时全开就成了监控。\n\n上一段感情的结束，不是因为你是火象，是因为你俩的需求规格不匹配。匹配的意义就在这儿——有人天生就觉得你的热烈刚刚好。"}]'::jsonb, now() - interval '5 days' + interval '3 minutes'),
    (t3, 'user', '[{"type":"text","text":"「有人觉得刚刚好」……可我每次一开始都很好，处着处着对方就说累了。"}]'::jsonb, now() - interval '4 days 20 hours'),
    (t3, 'assistant', '[{"type":"text","text":"那我们拆一下「处着处着就累了」通常是怎么发生的：\n\n一开始你的热烈是惊喜，对方给出同等回应，你的安全感满了。后来对方回到自己的正常节奏，你的雷达立刻报警：TA 是不是不爱我了？于是你加码表达、追问确认，对方更累、退得更远，你更慌——这就是焦虑循环。\n\n破解点在报警响起的那三秒。下次想发「你是不是不爱我了」之前，先问自己：TA 今天做了什么实际伤害我的事吗？如果答案是没有，就去跑个步、找朋友吐槽，把这波情绪代谢掉。\n\n安全感这东西，向对方索要只能管三小时，自己长出来的才管一辈子。\n\n你的说明书里「理想相处模式」那一节再读一遍，下次心动时，带着它去选人，而不是带着它去改造人。"}]'::jsonb, now() - interval '4 days 18 hours'),
    (t3, 'user', '[{"type":"text","text":"被你说中了，我确实是「报警-追问-对方后退」这个剧本。以后报警响的时候我先来找你聊。"}]'::jsonb, now() - interval '4 days 6 hours'),
    (t3, 'assistant', '[{"type":"text","text":"随时来，我这盏灯 24 小时亮着。\n\n不过也立个小约定：你可以来找我拆解情绪，但别让我替你做所有决定。军师的职责是帮你看清牌面，出牌的人永远是你。\n\n你这样的火象，学会了给自己的情绪搭桥，魅力值会直接翻倍。我看好你。"}]'::jsonb, now() - interval '4 days 5 hours');
END $$;
-- ---------- 7. 真实嘉宾人格与匹配数据（migration 081500） ----------
-- 真实嘉宾数据：来自 intellimatch 样本（md 解析）
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS bio text;

DELETE FROM public.counselor_messages WHERE thread_id IN (SELECT id FROM public.counselor_threads WHERE match_id IS NOT NULL);
DELETE FROM public.counselor_threads WHERE match_id IS NOT NULL;
DELETE FROM public.matches;
DELETE FROM public.personas;

INSERT INTO public.personas (id, nickname, gender, age, city, avatar, tagline, tags, manual, bio) VALUES
  ('a0000000-0000-4000-8000-000000000001', '雯子', 'female', 33, '广州', 'db:big-smile:雯子', '用户运营，爬山与喜欢看书', '["爬山", "喜欢看书", "运动健身", "喜欢宠物/动物"]'::jsonb, '{"hobbies": ["爬山", "喜欢看书", "运动健身", "喜欢宠物/动物"], "oneLiner": "现在在广州的互联网大厂做用户运营，工作日基本是早九晚八九点的节奏，周末双休", "idealMatch": "性格是我最看重的，希望对方主动一点、会张罗事，也懂得尊重人，和这样的人相处会更舒服。联系的频率可以高一些，但不用时时刻刻黏着，毕竟我平时加班时间比较久。如果有自己长久热爱的事情就更好，互相欣赏也不用强行凑到一起，有共同爱好当然也不错。 消费上能做到量入为出就好，做事有计划有条理、", "occupation": "用户运营", "industry": "互联网", "income": "25-30万", "height": "162cm", "education": "本科, 全日制, 贺州学院", "goal": "倾向结婚", "family": "家里有父母和弟弟，一家四口，现在自己独居。", "values": [], "strengths": [], "growth": [], "zodiac": "天蝎座", "element": "水象"}'::jsonb, '现在在广州的互联网大厂做用户运营，工作日基本是早九晚八九点的节奏，周末双休。平时吃饭大多在公司食堂解决，很少点外卖。'),
  ('a0000000-0000-4000-8000-000000000002', '朗天', 'male', 34, '广州', 'db:micah:朗天', '算法工程师，做饭烘焙与喜欢大自然', '["做饭烘焙", "喜欢大自然", "喜欢宠物/动物", "旅行户外", "健身", "喜欢大海", "露营", "潜水"]'::jsonb, '{"hobbies": ["做饭烘焙", "喜欢大自然", "喜欢宠物/动物", "旅行户外", "健身", "喜欢大海", "露营", "潜水"], "oneLiner": "在广州从事算法工程师相关的科研工作，生活两点一线，阶段性忙碌", "idealMatch": "年龄在27到43岁之间，有自己的工作，本科及以上学历的话会更合适。两个人相处的时候既有陪伴也有各自的独处空间，待在一起感觉舒服最重要，其他方面都可以商量着来。", "occupation": "算法工程师", "industry": "科研", "height": "181cm", "education": "硕士, 全日制, 复旦大学（顶级名校）", "goal": "倾向结婚", "family": "是独生子，父母很尊重我的想法和选择。", "values": [], "strengths": [], "growth": [], "zodiac": "狮子座", "element": "火象"}'::jsonb, '在广州从事算法工程师相关的科研工作，生活两点一线，阶段性忙碌。平时习惯独处，不忙的时候更喜欢一个人待着充电。'),
  ('a0000000-0000-4000-8000-000000000003', '晚', 'female', 26, '重庆', 'db:lorelei:晚', '旅行户外与喜欢穿搭爱好者', '["旅行户外", "喜欢穿搭", "刷剧达人", "无辣不欢", "资深夜猫子", "爱干净"]'::jsonb, '{"hobbies": ["旅行户外", "喜欢穿搭", "刷剧达人", "无辣不欢", "资深夜猫子", "爱干净"], "oneLiner": "重大毕业，目前在重庆定居，有房有车无贷款，老家是南充的，以后打算长期在重庆发展", "idealMatch": "希望对方是90后，一米七以上，长得干净清爽、会穿搭，有眼缘就好。学历最好是双一流学校，年薪最好15w+，工作不用经常加班，有双休、长白班，有购房购车的能力。性格沉稳、情绪稳定、温柔善良体贴、注重细节，有上进心，不冷暴力、不闷、也不是宅男，和外向爱张罗的人相处会更轻松。希望对方也爱", "income": "无收入", "height": "155cm", "education": "本科, 全日制, 重庆大学（985）", "goal": "倾向结婚", "family": "爸爸是退役军人，妈妈事业单位退休，都有退休金，我是独生女，家里经济条件还不错，父母都有保障。", "values": [], "strengths": [], "growth": [], "zodiac": "射手座", "element": "火象"}'::jsonb, '重大毕业，目前在重庆定居，有房有车无贷款，老家是南充的，以后打算长期在重庆发展。现阶段交友目标是奔着结婚去的。'),
  ('a0000000-0000-4000-8000-000000000004', 'jason', 'male', 25, '重庆', 'db:micah:jason', '公司创始人，健身与骑行爱好者', '["健身", "骑行爱好者", "投资理财"]'::jsonb, '{"hobbies": ["健身", "骑行爱好者", "投资理财"], "oneLiner": "ESTJ，创业男 会沟通型双鱼座 现在在重庆做教育内容工作室的创业，工作日周一到周五上班，时间相对自由，偶尔会加班，周末", "idealMatch": "性格温柔体贴，会主动关心人，孝顺善良、懂得换位思考，认知高、性格好，有话愿意沟通不藏着掖着，做事有条理的J人相处起来会更舒服。希望对方工作轻松一点，能多花时间陪伴，有自己的爱好可以一起尝试，家庭和睦，经济上能自给自足就行，平时提前沟通好行程，相互理解就好。", "occupation": "公司创始人", "industry": "教育", "income": "50-100万", "height": "172cm", "education": "硕士, 全日制, 重庆师范大学, 在读", "goal": "倾向结婚", "family": "是独生子，爸爸是医生，妈妈是老师，都在宜宾老家的小镇上工作，收入稳定，家庭氛围和睦。", "values": [], "strengths": [], "growth": [], "zodiac": "水瓶座", "element": "风象"}'::jsonb, 'ESTJ，创业男 会沟通型双鱼座 现在在重庆做教育内容工作室的创业，工作日周一到周五上班，时间相对自由，偶尔会加班，周末有空，9月之后工作日晚上要读工商管理硕士，除了主业还有其他投资产业，压力不算大。'),
  ('a0000000-0000-4000-8000-000000000005', '骏豪', 'male', 32, '惠州', 'db:adventurer:骏豪', 'CAD 绘图员，游戏电竞与骑行爱好者', '["游戏电竞", "喜欢学习新技能", "骑行爱好者", "乒乓球"]'::jsonb, '{"hobbies": ["游戏电竞", "喜欢学习新技能", "骑行爱好者", "乒乓球"], "oneLiner": "我是广东汕尾城区人，在惠州五金工厂担任CAD绘图员，日常工作之余能留出可自由支配的时间，但不喜欢自己一个人外出游玩，平时", "idealMatch": "希望对方性格主动活泼、粘人一点（因为自己也粘人～哈哈哈），能时刻给我情绪回应，双向奔赴，性格爱好要合得来，最好能玩到一块儿。不求过度的肤白貌美，但也希望不差过新垣结衣～两个人在一起最好能天天联系，长期相处，奔着早日结婚去互相了解，遇事不轻易冷战，个人认为两人在一起之后大事需要一起", "occupation": "CAD 绘图员", "industry": "五金制造", "height": "172cm", "education": "高中及以下", "goal": "倾向结婚", "family": "父亲在五金工厂上班，由父亲和朋友合作创办，母亲有自己的小作坊在深圳宝安，生活虽算不上富裕，但也能吃饱吃好能穿暖，姐姐已经出嫁和姐夫一起在汕尾城区老家发展，还有个 08 年的弟弟正在深圳光明就读中专，家里人关系和睦，感情深厚，父母亲对我未来另", "values": [], "strengths": [], "growth": [], "zodiac": "水瓶座", "element": "风象"}'::jsonb, '我是广东汕尾城区人，在惠州五金工厂担任CAD绘图员，日常工作之余能留出可自由支配的时间，但不喜欢自己一个人外出游玩，平时下班就是自己待着，有人邀请就会一起出去，日常作息也算规律，习惯夜里十二点睡白天七八点醒，算是夜猫一个～性格上有点长不大，爱闹，爱逗人笑'),
  ('a0000000-0000-4000-8000-000000000006', '盼得一良人', 'female', 28, '惠州', 'db:lorelei:盼得一良人', '普工，喜欢看书与跑步', '["喜欢看书", "跑步", "美食鉴赏家"]'::jsonb, '{"hobbies": ["喜欢看书", "跑步", "美食鉴赏家"], "oneLiner": "现在在惠州的电子厂做普工，工作节奏不算太赶，下班后有自己的时间可以安排", "idealMatch": "比较看重性格，开朗主动、有责任心、积极向上有冲劲的人相处起来会更舒服。年龄在20到30岁之间，同样在制造业工作的话会更有共同话题。相处的时候各自有自己的空间就很好，生活习惯上如果有不一样的地方，愿意互相调整就可以。", "occupation": "普工", "industry": "制造业", "height": "153cm", "education": "高中及以下", "goal": "倾向恋爱", "family": "妈妈在桂林老家，现在自己一个人在惠州住，生活上比较自由。", "values": [], "strengths": [], "growth": [], "zodiac": "金牛座", "element": "土象"}'::jsonb, '现在在惠州的电子厂做普工，工作节奏不算太赶，下班后有自己的时间可以安排。'),
  ('a0000000-0000-4000-8000-000000000007', 'sophiaso', 'female', 31, '苏州', 'db:big-smile:sophiaso', '合规，普拉提与爱逛美术馆', '["普拉提", "爱逛美术馆", "徒步", "旅行户外", "话剧"]'::jsonb, '{"hobbies": ["普拉提", "爱逛美术馆", "徒步", "旅行户外", "话剧"], "oneLiner": "工作换来换去，目前是两点一线国企打工人", "idealMatch": "受过良好教育，情绪稳定，乐于沟通交流。 “聊得来”可能有点抽象，但确实非常重要。希望可以是彼此最好的朋友，分享生活的琐碎和人生的困惑。 以及鉴于我是个i人，可能需要对方稍微主动一些，当然我也会尽力回应和表达的。", "occupation": "合规", "industry": "制造业", "income": "30-50万", "height": "161cm", "education": "硕士, 全日制, 苏黎世大学", "goal": "倾向恋爱", "family": "独生子女，家人都在惠州。", "values": [], "strengths": [], "growth": [], "zodiac": "天秤座", "element": "风象"}'::jsonb, '工作换来换去，目前是两点一线国企打工人。最长期的坚持也许是看着有点理想主义的工作内容，然而日常都在被现实毒打。'),
  ('a0000000-0000-4000-8000-000000000008', 'Leo', 'male', 28, '苏州', 'db:micah:Leo', '工程师，听播客与民宿体验家', '["听播客", "民宿体验家", "喜欢出国玩", "爱看电影", "喜欢宠物/动物", "物欲低", "Citywalk", "自由行"]'::jsonb, '{"hobbies": ["听播客", "民宿体验家", "喜欢出国玩", "爱看电影", "喜欢宠物/动物", "物欲低", "Citywalk", "自由行"], "oneLiner": "现在在苏州做工程师，外企，工作不算忙，时间比较自由", "idealMatch": "有爱人和被爱的能力，年龄相仿、学历相近的人相处会更合拍，有见过世界，依然保持好奇和疑问，在长三角工作生活最好是在苏州，平时各自有独立的空间，性格偏安静。如果能一起看视频、听播客、看电影看书就最好了，消费在能力范围内就好，也喜欢小动物的话相处起来会更融洽。", "occupation": "工程师", "industry": "半导体", "income": "50-100万", "height": "170cm", "education": "硕士, 全日制, 苏州城市大学（等同于985）", "goal": "倾向恋爱", "family": "家里有兄弟姐妹，和爸妈关系还行，平时沟通不多，比较有自己的空间。", "values": [], "strengths": [], "growth": [], "zodiac": "天秤座", "element": "风象"}'::jsonb, '现在在苏州做工程师，外企，工作不算忙，时间比较自由。希望这几年在财富上有一定积累，事业能有大的突破，之后找合适的地方定居。'),
  ('a0000000-0000-4000-8000-000000000009', '心宁是归处', 'female', 44, '贵阳', 'db:lorelei:心宁是归处', '总经理，KTV与休闲游戏', '["KTV", "休闲游戏", "喜欢看书", "旅行户外", "刷剧达人", "爱看电影"]'::jsonb, '{"hobbies": ["KTV", "休闲游戏", "喜欢看书", "旅行户外", "刷剧达人", "爱看电影"], "oneLiner": "我是82年的，金牛座，2024年离异，有个儿子跟他爸，上小学了，现在负责公司的一家分公司，在毕节，所以近一两年预计是一半", "idealMatch": "理想的伴侣是情绪稳定，热爱生活，愿意主动沟通分享，性格合拍最重要。最好有稳定工作，大专以上学历，作息相近的话相处起来会更舒服，有共同爱好就更能玩到一块儿。平时每天保持联系，两个人有空可以一起逛公园、看电影，偶尔一起做做饭就挺好。", "occupation": "总经理", "industry": "贸易", "income": "25-30万", "height": "155cm", "education": "大专, 非全日制, 贵州民族大学（等同于211）", "goal": "倾向恋爱", "family": "父母都住在贵阳，都已经退休，还有一个弟弟，已经结婚生小孩了。", "values": [], "strengths": [], "growth": [], "zodiac": "巨蟹座", "element": "水象"}'::jsonb, '我是82年的，金牛座，2024年离异，有个儿子跟他爸，上小学了，现在负责公司的一家分公司，在毕节，所以近一两年预计是一半在贵阳，一半在毕节，分公司这边理顺以后计划调回贵阳工作，在贵阳有房有车无贷款，生活比较安稳。'),
  ('a0000000-0000-4000-8000-000000000010', 'Jasper', 'male', 41, '贵阳', 'db:micah:Jasper', '工程师，流行与想环游世界', '["流行", "想环游世界", "做饭烘焙", "英雄联盟", "任天堂", "王者荣耀", "喜欢研究数码", "羽毛球"]'::jsonb, '{"hobbies": ["流行", "想环游世界", "做饭烘焙", "英雄联盟", "任天堂", "王者荣耀", "喜欢研究数码", "羽毛球"], "oneLiner": "在贵州省广电局上班，工程师，工作是上一周休一周的模式，忙的时候也会临时加班或者开会，整体生活节奏比较慢，重要的事都会当日", "idealMatch": "我理想中的另一半，待人真诚守信，遇事有担当，信守承诺不逃避问题。相处里懂得互相体谅，凡事愿意沟通商量，不会刻意隐瞒自身实际情况。看待感情秉持双向奔赴的心态，愿意和我一同规划未来，遇事共同承担，不单方面把压力丢给对方。品行端正有责任心，重视彼此之间的信任，答应的事会尽力兑现，两个人", "occupation": "工程师", "industry": "广播电视", "income": "10-15万", "height": "178cm", "education": "大专, 全日制, 贵州水利水电职业技术学院", "goal": "倾向结婚", "family": "父母都是国营单位退休职工。家里只有我一个儿子，有退休金生活无忧。", "values": [], "strengths": [], "growth": [], "zodiac": "水瓶座", "element": "风象"}'::jsonb, '在贵州省广电局上班，工程师，工作是上一周休一周的模式，忙的时候也会临时加班或者开会，整体生活节奏比较慢，重要的事都会当日事当日毕。'),
  ('a0000000-0000-4000-8000-000000000011', '软软奶糕', 'female', 30, '长沙', 'db:adventurer:软软奶糕', '公务员，端游与网球', '["端游", "网球", "古典乐", "钢琴", "喜欢宠物/动物", "羽毛球"]'::jsonb, '{"hobbies": ["端游", "网球", "古典乐", "钢琴", "喜欢宠物/动物", "羽毛球"], "oneLiner": "本科湖师大，研究生中南大mpa,在省直厅局做公务员，工作日偶尔加班，一般六点左右就能下班，周末双休基本能保证，工作节奏挺", "idealMatch": "性格安静踏实、沉稳，能在自己的工作领域深入钻研，不说空话大话。相处起来节奏同步，每天保持联系就好，不用刻意互相带动。希望对方有自己热爱且能长期坚持的事，家庭氛围和睦，经济条件至少小康，两个人吃饭口味能合得来，相处起来会更舒服。", "occupation": "公务员", "industry": "体制内", "income": "15-20万", "height": "160cm", "education": "硕士, 非全日制, 中南大学（985）", "goal": "倾向结婚", "family": "家里经商，父母感情和睦，母亲是国企退休有退休金，父亲生意收入完全够养老了。有个弟弟目前在湖南大学读博，家住岳麓。自己个人名下在一些旅游城市还有些小房子。", "values": [], "strengths": [], "growth": [], "zodiac": "摩羯座", "element": "土象"}'::jsonb, '本科湖师大，研究生中南大mpa,在省直厅局做公务员，工作日偶尔加班，一般六点左右就能下班，周末双休基本能保证，工作节奏挺稳定的。'),
  ('a0000000-0000-4000-8000-000000000012', '南山野莓子', 'male', 28, '未知', 'db:micah:南山野莓子', '喜欢看书与综艺爱好者', '["喜欢看书", "综艺", "足球", "跑步", "人文社科", "自由行", "特种兵旅行", "Citywalk"]'::jsonb, '{"hobbies": ["喜欢看书", "综艺", "足球", "跑步", "人文社科", "自由行", "特种兵旅行", "Citywalk"], "oneLiner": "目前在互联网大厂做研发，早十晚八的节奏，稍微有点忙，工作日更愿意自己独处回血，周末会出去见朋友", "idealMatch": "希望对方年龄在25到30岁，学历211本科以上当然更好，工作是正常上班族就可以。性格外向些的话沟通起来会更轻松，两个人能聊到一起是最重要的，最好是善良不刻薄、情绪稳定的人，相处起来能每天保持一次有效沟通，每周见一次面的节奏就很舒服。", "family": "是独生子，爸妈在成都，爸爸在国企内退，家庭结构简单。", "values": [], "strengths": [], "growth": [], "zodiac": "金牛座", "element": "土象"}'::jsonb, '目前在互联网大厂做研发，早十晚八的节奏，稍微有点忙，工作日更愿意自己独处回血，周末会出去见朋友。'),
  ('a0000000-0000-4000-8000-000000000013', '奶萌猪', 'female', 40, '未知', 'db:big-smile:奶萌猪', 'KTV与钓鱼佬爱好者', '["KTV", "钓鱼佬", "刷剧达人"]'::jsonb, '{"hobbies": ["KTV", "钓鱼佬", "刷剧达人"], "oneLiner": "本人是偏向活泼开朗型的，可盐可甜～", "idealMatch": "暂不接受离异哈，我还是喜欢两个人纯粹的感情，不希望有第三个人的存在。 和生活习惯随性、会聊天的人相处起来会更舒服，性格活泼的话会更有好感。希望对方工作稳定，年收入20万以上，父母有社保，计划长期在广州发展，日常愿意每天聊天分享生活，真诚接触～", "family": "独生女，爸爸是公务员，妈妈已经退休在领退休金，父母都善良正直的老实人，家庭情况比较稳定。", "values": [], "strengths": [], "growth": [], "zodiac": "双子座", "element": "风象"}'::jsonb, '本人是偏向活泼开朗型的，可盐可甜～'),
  ('a0000000-0000-4000-8000-000000000014', '林知野', 'male', 40, '未知', 'db:micah:林知野', '学过一种乐器与竞技类游戏爱好者', '["学过一种乐器", "竞技类游戏", "喜欢宠物/动物", "旅行户外", "爱看电影", "爬山"]'::jsonb, '{"hobbies": ["学过一种乐器", "竞技类游戏", "喜欢宠物/动物", "旅行户外", "爱看电影", "爬山"], "oneLiner": "我是电控软件工程师，在世界500强的新能源公司工作，工作日早八点半到晚六七点钟下班，周末双休，节奏不算太忙，平时生活基本", "idealMatch": "希望对方性格活泼开朗、会为他人着想、有自己的见解、遇事好商量，平时愿意主动分享生活里的大小事，每天都有沟通。消费观念偏理性，相处起来会更合拍。期待两个人可以一起去旅游、爬山、做手工，共同体验和探索新的事，之后还可以一起养小猫小狗。", "family": "父母都在东莞居住，目前已经退休，身体都健康。", "values": [], "strengths": [], "growth": [], "zodiac": "双子座", "element": "风象"}'::jsonb, '我是电控软件工程师，在世界500强的新能源公司工作，工作日早八点半到晚六七点钟下班，周末双休，节奏不算太忙，平时生活基本是公司和宿舍两点一线，比较简单。'),
  ('a0000000-0000-4000-8000-000000000015', '禾叶禾', 'female', 39, '未知', 'db:lorelei:禾叶禾', '美食鉴赏家与喜欢看书爱好者', '["喜欢宠物/动物", "美食鉴赏家", "喜欢看书", "家有狗狗"]'::jsonb, '{"hobbies": ["喜欢宠物/动物", "美食鉴赏家", "喜欢看书", "家有狗狗"], "oneLiner": "坐标甘肃兰州，就职于新能源央企机关党群", "idealMatch": "期待遇见一位内核安稳的男生，性格温和舒展，遇事情绪平和。有自己的想法与判断力，同时也愿意平等沟通，懂得换位思考，愿意耐心倾听彼此的心声，不独断强势，尊重两个人不同的观点。 希望在关系里你可以多主动一些，愿意开启话题、主动邀约，慢慢拉近彼此距离。我属于慢热型，当我感受到诚意与好感，", "family": "三口之家加一狗，爸妈都是银行职工，家庭氛围温馨有爱。", "values": [], "strengths": [], "growth": [], "mbti": "ENFP", "zodiac": "水瓶座", "element": "风象"}'::jsonb, '坐标甘肃兰州，就职于新能源央企机关党群。 工作之外偏爱给自己留独处充电的时间，比起热闹局，更享受一个人觅食探店，靠各色美食消解疲惫、治愈日常。 有一个坚持十余年的长久爱好——读小说，涉猎很杂，玄幻修仙、机甲科幻、言情世情、悬疑推理都愿意看，精神世界供给充足。 对未来有清晰规划：希望谋求收入更好的发展机会，也计划购置属于自己的新居；期待3年内步入婚姻。现阶段扎根兰州，如若遇见合适机遇，也不排斥换城市生活。 生活作息自律，一般23点左右休息。 饮食小雷区：完全不吃香菜。'),
  ('a0000000-0000-4000-8000-000000000016', 'D', 'male', 27, '兰州', 'db:micah:D', '设计师，旅行户外与猫狗双全', '["吉他/尤克里里", "旅行户外", "猫狗双全", "喜欢宠物/动物", "喜欢看书", "音乐演出", "听播客"]'::jsonb, '{"hobbies": ["吉他/尤克里里", "旅行户外", "猫狗双全", "喜欢宠物/动物", "喜欢看书", "音乐演出", "听播客"], "oneLiner": "在兰州做设计师，工作很忙，平时几乎两点一线，更习惯自己独处，偶尔才和朋友聚聚", "idealMatch": "年龄和我差不多，本科学历，有上进心，工作稳定的话相处起来会更合拍。性格开朗，外形高挑的话我会更有好感。家庭里父母关系和睦，经济和文化水平适中，不会拖累彼此就好。作息和我同频，能接受我的旅行和音乐爱好，聊得来、有共同语言的话相处会更舒服。", "occupation": "设计师", "industry": "设计", "height": "180cm", "education": "本科, 全日制, 米兰布雷拉美术学院", "goal": "倾向结婚", "family": "独生子 家庭和睦", "values": [], "strengths": [], "growth": [], "mbti": "ENFP", "zodiac": "水瓶座", "element": "风象"}'::jsonb, '在兰州做设计师，工作很忙，平时几乎两点一线，更习惯自己独处，偶尔才和朋友聚聚。'),
  ('a0000000-0000-4000-8000-000000000017', '小向日葵', 'female', 28, '长沙', 'db:adventurer:小向日葵', '新媒体运营，需要个人空间与古典乐', '["喜欢学习新技能", "需要个人空间", "周末必须出去玩", "古典乐", "喜欢画画", "爱看艺术类纪录片", "摄影爱好者", "国漫"]'::jsonb, '{"hobbies": ["喜欢学习新技能", "需要个人空间", "周末必须出去玩", "古典乐", "喜欢画画", "爱看艺术类纪录片", "摄影爱好者", "国漫"], "oneLiner": "现在在长沙做新媒体运营，工作朝九晚五大小休，上班的时候习惯全神贯注，基本不加班，只有关键节点会配合一下", "idealMatch": "和沉稳理性、聪明讲原则的人相处会更舒服，相处时能聊得来，愿意主动分担家务，有话直说不刻意隐瞒。对方最好有长沙的购房能力，身高一米七以上，外形顺眼，平时不抽烟，没有纹身，喝酒可以偶尔小酌。两个人前期可以天天联系，相处久了也能各自保留空间，经济上一起规划，遇事能互相尊重，相处起来踏实", "occupation": "新媒体运营", "industry": "教育", "income": "10-15万", "height": "157cm", "education": "本科, 全日制, 湖南文理学院芙蓉学院", "goal": "倾向结婚", "family": "老家在荆州，有个小13岁的妹妹现在上高一，爸爸以前是司机，现在偶尔做点小生意，家里条件普通，自己的事基本能自己拿主意。我爸妈是不太愿意占我便宜的，每年暑假我都会接妹妹过来玩，我妈都会让我妹给我带一堆吃的，每年冬天寄东西的时候我妈都会给我寄很", "values": [], "strengths": [], "growth": [], "zodiac": "金牛座", "element": "土象"}'::jsonb, '现在在长沙做新媒体运营，工作朝九晚五大小休，上班的时候习惯全神贯注，基本不加班，只有关键节点会配合一下。'),
  ('a0000000-0000-4000-8000-000000000018', 'Vincent', 'male', 34, '长沙', 'db:micah:Vincent', '行业经理，唱歌与旅行', '["唱歌", "旅行", "电影", "徒步", "阅读", "骑行"]'::jsonb, '{"hobbies": ["唱歌", "旅行", "电影", "徒步", "阅读", "骑行"], "oneLiner": "湖南益阳人，现在定居长沙，从事纳米材料行业开发的工作，公司产品属于应用很广的材料，涉猎的行业很多，会接触各行各业的人，比", "idealMatch": "我理想的另一半是一个受过良好教育、情绪稳定、待人真诚善良的人，能够相濡以沫，一起过好自己的小日子，可以一起探索世界。希望你热爱生活，懂得从生活中各个小细节找到快乐。", "occupation": "行业经理", "industry": "纳米材料", "height": "173cm", "education": "本科, 全日制, 湖南理工学院", "goal": "倾向结婚", "family": "家里成员：父母和两个姐姐，姐姐都已婚已育，大姐一个儿子、一个女儿，小姐一个儿子，家庭氛围很好。", "values": [], "strengths": [], "growth": [], "zodiac": "射手座", "element": "火象"}'::jsonb, '湖南益阳人，现在定居长沙，从事纳米材料行业开发的工作，公司产品属于应用很广的材料，涉猎的行业很多，会接触各行各业的人，比如：新能源汽车、半导体芯片、锂电池、有机硅、食品、医药、胶粘剂、涂料等等。生活里属于动静皆宜，工作之余爱运动，比如骑行、户外徒步等。不想出门的时候，也享受安静独处，喜欢阅读，补充大脑营养。对待感情很认真，是比较直球的性格。不搞暧昧，不喜欢猜来猜去、又或者内耗拉扯，更看重坦诚直接、高效舒服的沟通。'),
  ('a0000000-0000-4000-8000-000000000019', 'Eric', 'male', 40, '杭州', 'db:adventurer:Eric', '运营总监，喜欢看书与投资理财', '["喜欢看书", "投资理财", "跑步", "徒步", "爬山", "做饭烘焙"]'::jsonb, '{"hobbies": ["喜欢看书", "投资理财", "跑步", "徒步", "爬山", "做饭烘焙"], "oneLiner": "在杭州互联网电商平台做运营总监，工作已经比较稳定，朝十晚七双休不怎么加班，时间相对自由，主要负责策略制定和大盘把控", "idealMatch": "性格排第一位，主动外向能带动节奏，遇事能好好沟通，情绪稳定不过激就好。和原生家庭和睦的人相处会更舒服，人品好有同理心、愿意付出，有成长型思维、愿意不断精进自己，收入和能力匹配，消费不超前。作息正常，最好能吃到一起，不用一点辣都吃不了。平时能有每天共同相处交流的时间，也能融入彼此的", "occupation": "运营总监", "industry": "互联网", "income": "50-100万", "height": "176cm", "education": "硕士, 全日制, 精英大学", "goal": "倾向结婚", "family": "有个龙凤胎妹妹，已经在老家结婚生子，父母健在，家庭氛围和睦。 父母除了有退休金，还有稳定的收租", "values": [], "strengths": [], "growth": [], "mbti": "ENFJ", "zodiac": "双子座", "element": "风象"}'::jsonb, '在杭州互联网电商平台做运营总监，工作已经比较稳定，朝十晚七双休不怎么加班，时间相对自由，主要负责策略制定和大盘把控。'),
  ('a0000000-0000-4000-8000-000000000020', '苏也林栖客', 'female', 32, '杭州', 'db:adventurer:苏也林栖客', 'HRBP，美食鉴赏家与音乐演出', '["星座/塔罗/玄学", "美食鉴赏家", "音乐演出", "普拉提", "做饭烘焙", "喜欢看书", "家有猫猫", "爱看电影"]'::jsonb, '{"hobbies": ["星座/塔罗/玄学", "美食鉴赏家", "音乐演出", "普拉提", "做饭烘焙", "喜欢看书", "家有猫猫", "爱看电影"], "oneLiner": "目前在杭州从事具身智能行业的HRBP工作，年收入30-50万，打算长期在杭州定居，近一两年的目标是结婚生子，之后可能会把", "idealMatch": "相处时希望一周能见1-2次，偶尔各自有空间就好，遇到问题能积极沟通，不要逃避失联，感情上专一，两个人遇事可以有商有量，对未来有共同的规划。希望对方是一个引导型爱人，收入比我高、在杭州有房有车，身高180以上体型健硕，有少年感，性格沉稳有主见能给我引导，会更合得来。", "occupation": "HRBP", "industry": "具身智能", "income": "30-50万", "height": "168cm", "education": "本科, 全日制, 青岛大学", "goal": "倾向结婚", "family": "是独生子女，父母在山东威海老家，母亲已经退休，父亲即将退休，身体都很健康，家里没有过多负担。", "values": [], "strengths": [], "growth": [], "mbti": "INFJ", "zodiac": "处女座", "element": "土象"}'::jsonb, '目前在杭州从事具身智能行业的HRBP工作，年收入30-50万，打算长期在杭州定居，近一两年的目标是结婚生子，之后可能会把重心更多放在家庭上。'),
  ('a0000000-0000-4000-8000-000000000021', '苏漫漫漫漫', 'female', 39, '杭州', 'db:lorelei:苏漫漫漫漫', '管理类，爱看电影与运动健身', '["爱看电影", "运动健身", "旅行户外", "听播客", "爱喝咖啡", "看书很杂"]'::jsonb, '{"hobbies": ["爱看电影", "运动健身", "旅行户外", "听播客", "爱喝咖啡", "看书很杂"], "oneLiner": "经过了漫长的季节，一切似乎又开始萌芽、生长", "idealMatch": "希望你成熟稳重，情绪稳定，善良真诚，偶尔幽默。 见过世面，眼里还有光。 有自己热爱的事，也愿意和我互相支撑。 尊重我和我在乎的人，亲密但有边界。 身体健康，没有坏瘾，懂得爱自己。 ——这些也是我对自己的期待。我们慢慢来。", "occupation": "管理类", "industry": "高科技", "height": "166cm", "education": "硕士, 全日制, 浙江大学（985）", "goal": "倾向结婚", "family": "父母退休，稳定支持我，小家庭温暖。", "values": [], "strengths": [], "growth": [], "zodiac": "水瓶座", "element": "风象"}'::jsonb, '经过了漫长的季节，一切似乎又开始萌芽、生长。那些埋藏在土里的，终将成为记忆。无论是伤痛还是滋养，都会给予新生的力量。'),
  ('a0000000-0000-4000-8000-000000000022', 'Ken', 'male', 48, '杭州', 'db:micah:Ken', '项目总，旅行户外与美食鉴赏家', '["旅行户外", "美食鉴赏家", "喜欢看书", "人文社科"]'::jsonb, '{"hobbies": ["旅行户外", "美食鉴赏家", "喜欢看书", "人文社科"], "oneLiner": "目前在文化创意行业做项目总，工作不忙，平时空闲时间喜欢阅读，生活节奏比较平稳", "idealMatch": "希望对方性格懂得理解和包容，有知性的气质，两个人相处时能各自保有独立空间会更舒服。外形上颜值在线，体型匀称就挺好，年龄比我小一些，以后打算长期在杭州发展的话相处起来会更合拍。", "occupation": "项目总", "industry": "文化创意", "height": "173cm", "education": "本科, 全日制, 香港城市大学", "goal": "倾向恋爱", "values": [], "strengths": [], "growth": [], "zodiac": "双鱼座", "element": "水象"}'::jsonb, '目前在文化创意行业做项目总，工作不忙，平时空闲时间喜欢阅读，生活节奏比较平稳。'),
  ('a0000000-0000-4000-8000-000000000023', '戴安', 'female', 31, '未知', 'db:adventurer:戴安', '滑雪与健身爱好者', '["滑雪", "健身", "露营", "潜水", "冲浪", "家有猫猫"]'::jsonb, '{"hobbies": ["滑雪", "健身", "露营", "潜水", "冲浪", "家有猫猫"], "oneLiner": "喜欢户外运动，滑雪从2022年坚持到现在，喜欢陆冲、露营，接下来准备精进冲浪和潜水，今年又解锁了锡林郭勒骑马", "idealMatch": "希望对方三观正，有责任和担当，性格积极主动，相处的时候能双向奔赴，慢慢磨合出两个人都舒服的沟通节。还有就是能吃到一起聊到一起，有一部分共同的爱好。", "family": "老爸经商，老妈退休，有两个姐姐都在临州，她们都已经结婚生子，家里氛围很热闹。", "values": [], "strengths": [], "growth": [], "zodiac": "天秤座", "element": "风象"}'::jsonb, '喜欢户外运动，滑雪从2022年坚持到现在，喜欢陆冲、露营，接下来准备精进冲浪和潜水，今年又解锁了锡林郭勒骑马。露营的时候有时候会约朋友一起聊天分享，偶尔也会一个人去安安静静感受自然。养了十年的猫，生活里很习惯有它的陪伴。'),
  ('a0000000-0000-4000-8000-000000000024', '宇宇', 'male', 38, '临州', 'db:micah:宇宇', '运营经理，旅行户外与摄影爱好者', '["旅行户外", "摄影爱好者", "无辣不欢", "骑行", "运动健身"]'::jsonb, '{"hobbies": ["旅行户外", "摄影爱好者", "无辣不欢", "骑行", "运动健身"], "oneLiner": "法国10年生活，现居临州", "idealMatch": "期待另一半： 善良，热爱生活，有共情力，家庭氛围好。", "occupation": "运营经理", "industry": "外企运动零售", "income": "20-25万", "height": "170cm", "education": "本科, 全日制, 里昂大学", "goal": "倾向结婚", "family": "独生子，家人已退休生活无压力。", "values": [], "strengths": [], "growth": [], "zodiac": "天秤座", "element": "风象"}'::jsonb, '法国10年生活，现居临州。');

INSERT INTO public.matches (id, user_id, persona_id, score, highlights, status) VALUES ('b0000000-0000-4000-8000-000000000001', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', 'a0000000-0000-4000-8000-000000000019', 88, '["同城杭州，见面成本低", "都倾向结婚，目标一致", "作息规律，节奏合拍"]'::jsonb, 'liked');
INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation) VALUES ('c0000000-0000-4000-8000-000000000001', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', '和 Eric 从掼蛋聊到见面', 'match', 'b0000000-0000-4000-8000-000000000001', '匹配后的真实聊天记录');
INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "你好"}]'::jsonb, '2026-02-25T19:02:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "晚上好呀"}]'::jsonb, '2026-02-25T22:51:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "😎"}]'::jsonb, '2026-02-25T22:51:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "早～"}]'::jsonb, '2026-02-26T09:41:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "周末过得怎么样呀"}]'::jsonb, '2026-02-26T20:19:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "刚跟朋友吃完饭"}]'::jsonb, '2026-02-26T20:19:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "打会掼蛋"}]'::jsonb, '2026-02-26T20:20:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "我昨晚睡很早"}]'::jsonb, '2026-02-27T18:20:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "今天有点忙"}]'::jsonb, '2026-02-27T18:20:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "看来你的作息很规律"}]'::jsonb, '2026-02-27T18:26:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "早睡早起"}]'::jsonb, '2026-02-27T18:26:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "还行  偶尔也放纵"}]'::jsonb, '2026-02-27T18:59:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "偶尔一下"}]'::jsonb, '2026-02-27T19:45:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "也挺好"}]'::jsonb, '2026-02-27T21:55:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "刚发现字打了一半"}]'::jsonb, '2026-02-27T21:56:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "放纵的时候你会干什么"}]'::jsonb, '2026-02-27T21:57:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "买买买  小酌  晚睡晚起"}]'::jsonb, '2026-02-27T22:02:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "自己也干不了啥了😅"}]'::jsonb, '2026-02-27T22:02:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "刚下班"}]'::jsonb, '2026-02-27T22:02:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "哇，辛苦啦"}]'::jsonb, '2026-02-27T22:07:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "加班到这么晚"}]'::jsonb, '2026-02-27T22:08:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "小酌我可以哈哈哈"}]'::jsonb, '2026-02-27T22:08:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "我酒量很差 就一杯"}]'::jsonb, '2026-02-27T22:13:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "这山东美女…"}]'::jsonb, '2026-02-27T22:33:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "哈哈😄"}]'::jsonb, '2026-02-27T22:33:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "是呐  给家乡丢人了哈哈"}]'::jsonb, '2026-02-27T22:47:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "没关系"}]'::jsonb, '2026-02-27T23:00:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "喝酒不行其他来凑"}]'::jsonb, '2026-02-27T23:00:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "哪些项目能给你带来多巴胺"}]'::jsonb, '2026-02-27T23:01:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "陪伴，深度交流，筹备旅行，听音乐会，摸小动物，挺多的"}]'::jsonb, '2026-02-27T23:09:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "这些也能给我带来愉悦"}]'::jsonb, '2026-02-27T23:21:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "深度交流"}]'::jsonb, '2026-02-27T23:21:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "看来你也注重精神层面的交流"}]'::jsonb, '2026-02-27T23:22:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "嗯 不然多孤独"}]'::jsonb, '2026-02-27T23:41:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "早呀"}]'::jsonb, '2026-02-28T09:31:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "是的，每天能有人聊聊天是个既简单又奢侈的事情"}]'::jsonb, '2026-02-28T09:32:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'user', '[{"type": "text", "text": "白天我一般很忙 你工作节奏咋样"}]'::jsonb, '2026-02-28T17:08:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "我现在还好"}]'::jsonb, '2026-02-28T17:23:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "间歇性忙一阵"}]'::jsonb, '2026-02-28T17:23:00+08'),
  ('c0000000-0000-4000-8000-000000000001', 'assistant', '[{"type": "text", "text": "感觉你们比较忙哈"}]'::jsonb, '2026-02-28T17:25:00+08');

INSERT INTO public.matches (id, user_id, persona_id, score, highlights, status) VALUES ('b0000000-0000-4000-8000-000000000002', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', 'a0000000-0000-4000-8000-000000000010', 82, '["同样重视精神交流", "都喜欢有规划的相处"]'::jsonb, 'liked');
INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation) VALUES ('c0000000-0000-4000-8000-000000000002', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', '和 Jasper 的深夜长谈', 'match', 'b0000000-0000-4000-8000-000000000002', '匹配后的真实聊天记录');
INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "哈喽，你好呀，我今天刚刚注册这个软件，你的描述挺打动我的，很高兴认识你呀！"}]'::jsonb, '2026-02-15T19:28:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "你好，很高兴认识你"}]'::jsonb, '2026-02-19T07:09:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "😀"}]'::jsonb, '2026-02-20T16:20:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "我看你说的工作模式是上一天休一天哦，感觉挺不错的吧"}]'::jsonb, '2026-02-20T16:20:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "我是上一周休一周"}]'::jsonb, '2026-02-20T16:21:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "怎么有这么舒服的班，羡慕了😁"}]'::jsonb, '2026-02-20T16:21:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "那上班的时候也是八个小时吗"}]'::jsonb, '2026-02-20T16:21:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "我们上班的时候不能回家的"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "一直待在单位"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "哦哦，相当于要守着设备什么的是吧"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "上班也是8小时，但是是24小时三班倒"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "是的"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "我是在广电局下属单位"}]'::jsonb, '2026-02-20T16:22:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "你现在还在毕节吗？"}]'::jsonb, '2026-02-20T16:23:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "只上8个小时，下班后就在单位休息是吧"}]'::jsonb, '2026-02-20T16:23:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "是的，在毕节"}]'::jsonb, '2026-02-20T16:23:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "是的，但是设备有问题，要及时处理"}]'::jsonb, '2026-02-20T16:23:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "明白了"}]'::jsonb, '2026-02-20T16:23:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "公司是你自己开的吗？"}]'::jsonb, '2026-02-20T16:24:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "那休息的时候你一般干嘛哇"}]'::jsonb, '2026-02-20T16:24:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "我是合伙人"}]'::jsonb, '2026-02-20T16:24:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "一般都宅在家"}]'::jsonb, '2026-02-20T16:24:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "也在管理运营公司"}]'::jsonb, '2026-02-20T16:24:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "是啥子行业的公司呢？"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "哦哦，那休息一周的时候一般也呆在家哇？"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "我看你写的是新辰盛，是财务公司吗"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "调味品"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'user', '[{"type": "text", "text": "商贸公司"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "是的，一般都在家"}]'::jsonb, '2026-02-20T16:25:00+08'),
  ('c0000000-0000-4000-8000-000000000002', 'assistant', '[{"type": "text", "text": "哦哦"}]'::jsonb, '2026-02-20T16:25:00+08');

INSERT INTO public.matches (id, user_id, persona_id, score, highlights, status) VALUES ('b0000000-0000-4000-8000-000000000003', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', 'a0000000-0000-4000-8000-000000000005', 76, '["都在广东，生活圈接近", "饮食口味都不挑"]'::jsonb, 'liked');
INSERT INTO public.counselor_threads (id, user_id, title, context_type, match_id, situation) VALUES ('c0000000-0000-4000-8000-000000000003', '098ecf7a-7391-41fc-bb9e-a7a5c3d617c1', '骏豪的慢慢了解计划', 'match', 'b0000000-0000-4000-8000-000000000003', '匹配后的真实聊天记录');
INSERT INTO public.counselor_messages (thread_id, role, parts, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "请问做什么行业的呢？"}]'::jsonb, '2025-12-24T10:07:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "厂里上班"}]'::jsonb, '2025-12-28T20:07:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "嗨"}]'::jsonb, '2025-12-28T20:10:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "你好，很高兴认识你[握手]"}]'::jsonb, '2025-12-28T20:12:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "你好啊"}]'::jsonb, '2025-12-28T20:13:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "我也是工厂上班的"}]'::jsonb, '2025-12-28T20:13:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "你们厂里做什么的"}]'::jsonb, '2025-12-28T20:16:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "是做手表带的"}]'::jsonb, '2025-12-28T20:16:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "嗯嗯"}]'::jsonb, '2025-12-28T20:16:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "还算常见的，哈哈"}]'::jsonb, '2025-12-28T20:17:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "[非文本消息]"}]'::jsonb, '2025-12-28T20:17:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "这种，不锈钢的"}]'::jsonb, '2025-12-28T20:18:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "看起来还挺高级的"}]'::jsonb, '2025-12-28T20:18:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "哈哈，是吗"}]'::jsonb, '2025-12-28T20:18:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "是的"}]'::jsonb, '2025-12-28T20:19:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "当年挺热门的"}]'::jsonb, '2025-12-28T20:20:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "你在惠州这边生活多久了？"}]'::jsonb, '2025-12-28T20:21:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "这个月刚来的"}]'::jsonb, '2025-12-28T20:22:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "刚来？以前在哪里工作呢？"}]'::jsonb, '2025-12-28T20:22:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "之前在老家"}]'::jsonb, '2025-12-28T20:22:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "广西吗？"}]'::jsonb, '2025-12-28T20:23:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "嗯嗯"}]'::jsonb, '2025-12-28T20:23:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "广西我去过钦州，哈哈"}]'::jsonb, '2025-12-28T20:23:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "来这边玩吗"}]'::jsonb, '2025-12-28T20:24:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "算是吧"}]'::jsonb, '2025-12-28T20:25:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "玩得怎么样"}]'::jsonb, '2025-12-28T20:25:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "还不错的"}]'::jsonb, '2025-12-28T20:26:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'assistant', '[{"type": "text", "text": "在惠州这边工作的怎么样？"}]'::jsonb, '2025-12-28T20:29:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "还好吧，有点不习惯"}]'::jsonb, '2025-12-28T20:30:00+08'),
  ('c0000000-0000-4000-8000-000000000003', 'user', '[{"type": "text", "text": "自己一个人太无聊了"}]'::jsonb, '2025-12-28T20:30:00+08');

-- ✅ 完成。演示账号：tenghuijin@163.com / Demo123456
