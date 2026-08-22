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