-- ============================================================
-- 修复演示账号登录报错 "Database error querying schema"
-- 原因：SQL 手动插入的用户，token 类文本列为 NULL，
--       Supabase Auth 登录时扫描这些列要求空字符串
-- 在 SQL Editor 里直接运行即可
-- ============================================================

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

-- 顺带把合并脚本也修正（下次重建库不再踩坑）：
-- 不需要手动做，下面这条只是验证一下当前用户行已无 NULL 文本列
select id, email,
       confirmation_token is null as ct_null,
       recovery_token is null as rt_null,
       phone is null as phone_null
from auth.users
where email = 'tenghuijin@163.com';
