UPDATE personas SET avatar = 'db:lorelei:Xiaoman' WHERE id = '55022ed5-2400-42c2-b379-1e04a1d22757';
UPDATE personas SET avatar = 'db:micah:Yizhou' WHERE id = '8e3a42d5-8df1-4df7-b66e-9b1588141d84';
UPDATE personas SET avatar = 'db:adventurer:Wanxing' WHERE id = '9b97550c-3947-41ea-b417-c810274d0a7f';
UPDATE personas SET avatar = 'db:adventurer:Zeming' WHERE id = 'cdff517b-5c5d-4850-b6f2-fb2711589eaa';
UPDATE personas SET avatar = 'db:big-smile:Wanzhou' WHERE id = '8483a33e-fcd1-4811-972b-b0278bba179f';
UPDATE personas SET avatar = 'db:micah:Chenyu' WHERE id = 'c6aa0069-eb22-465b-8922-0bdc25a75670';
UPDATE profiles SET avatar = 'db:adventurer:Mochi0'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tenghuijin@163.com');