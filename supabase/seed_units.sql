-- Lesson Track: Unit seed data
-- Run AFTER schema.sql (depends on content_groups existing)
-- Idempotent: uses ON CONFLICT to skip existing units

-- ============================================================
-- Helper: Look up content_group by subject name + display_order
-- This avoids relying on content_group name uniqueness
-- ============================================================

-- 1. 数学 > 1年のまとめ (subject='数学', display_order=1) — 25 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '数学' AND cg.display_order = 1
) cg,
(VALUES
  (1,  '正の数と負の数・正負の数の加法・減法'),
  (2,  '正負の数の乗法・除法'),
  (3,  '素数の積'),
  (4,  '正負の数の四則計算・分配法則'),
  (5,  '正負の数の応用問題'),
  (6,  '文字式の表し方'),
  (7,  '1次式の計算'),
  (8,  '等式・不等式'),
  (9,  '総合 正負の数、文字式①'),
  (10, '総合 正負の数、文字式②'),
  (11, '方程式とその解き方'),
  (12, '方程式の利用'),
  (13, '比例'),
  (14, '反比例'),
  (15, '総合 方程式,比例,反比例①'),
  (16, '総合 方程式,比例,反比例②'),
  (17, '平面図形'),
  (18, '作図'),
  (19, '空間図形'),
  (20, '表面積・体積'),
  (21, '総合 平面図形,空間図形①'),
  (22, '総合 平面図形,空間図形②'),
  (23, 'データの活用'),
  (24, '学年のまとめ①(正負の数~方程式)'),
  (25, '学年のまとめ②(比例~空間図形)')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 2. 数学 > 2年のまとめ (subject='数学', display_order=2) — 21 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '数学' AND cg.display_order = 2
) cg,
(VALUES
  (1,  '式の計算①(式の計算(基本))'),
  (2,  '式の計算②(式の計算 (応用))'),
  (3,  '式の計算③ (式の計算の利用)'),
  (4,  '連立方程式の計算'),
  (5,  '連立方程式の利用(基本)'),
  (6,  '連立方程式の利用(応用)'),
  (7,  '総合 式の計算,連立方程式①'),
  (8,  '総合 式の計算,連立方程式②'),
  (9,  '1次関数と直線の式'),
  (10, '1次関数の利用'),
  (11, '総合 1次関数①'),
  (12, '総合 1次関数②'),
  (13, '平行線と図形の角'),
  (14, '図形の証明①(合同・二等辺三角形)'),
  (15, '図形の証明②(直角三角形・平行四辺形・平行線と面積)'),
  (16, '総合 図形①'),
  (17, '総合 図形②'),
  (18, '確率'),
  (19, 'データの活用'),
  (20, '学年のまとめ① (式の計算~1次関数)'),
  (21, '学年のまとめ②(図形)')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 3. 英語 > 英熟語 高校入試重要300 (subject='英語', display_order=2) — 30 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '英語' AND cg.display_order = 2
) cg,
(VALUES
  (1,  '第1回'),  (2,  '第2回'),  (3,  '第3回'),  (4,  '第4回'),  (5,  '第5回'),
  (6,  '第6回'),  (7,  '第7回'),  (8,  '第8回'),  (9,  '第9回'),  (10, '第10回'),
  (11, '第11回'), (12, '第12回'), (13, '第13回'), (14, '第14回'), (15, '第15回'),
  (16, '第16回'), (17, '第17回'), (18, '第18回'), (19, '第19回'), (20, '第20回'),
  (21, '第21回'), (22, '第22回'), (23, '第23回'), (24, '第24回'), (25, '第25回'),
  (26, '第26回'), (27, '第27回'), (28, '第28回'), (29, '第29回'), (30, '第30回')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 4. 英語 > 英単語 高校入試重要600 (subject='英語', display_order=3) — 33 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '英語' AND cg.display_order = 3
) cg,
(VALUES
  (1,  '第1回'),  (2,  '第2回'),  (3,  '第3回'),  (4,  '第4回'),  (5,  '第5回'),
  (6,  '第6回'),  (7,  '第7回'),  (8,  '第8回'),  (9,  '第9回'),  (10, '第10回'),
  (11, '第11回'), (12, '第12回'), (13, '第13回'), (14, '第14回'), (15, '第15回'),
  (16, '第16回'), (17, '第17回'), (18, '第18回'), (19, '第19回'), (20, '第20回'),
  (21, '第21回'), (22, '第22回'), (23, '第23回'), (24, '第24回'), (25, '第25回'),
  (26, '第26回'), (27, '第27回'), (28, '第28回'), (29, '第29回'), (30, '第30回'),
  (31, '第31回'), (32, '第32回'), (33, '第33回')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 5. 英語 > 英文法 (subject='英語', display_order=1) — 37 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '英語' AND cg.display_order = 1
) cg,
(VALUES
  (1,  '【I】主語と動詞,品詞'),
  (2,  '【I】be動詞'),
  (3,  '【I】一般動詞'),
  (4,  '【I】名詞,複数形,冠詞'),
  (5,  '【I】形容詞、副詞'),
  (6,  '【I】疑問詞'),
  (7,  '【I】前置詞'),
  (8,  '【I】命令文,感嘆文'),
  (9,  '【I】canの文'),
  (10, '【I】3人称単数現在'),
  (11, '【I】代名詞'),
  (12, '【I】現在進行形'),
  (13, '【Ⅰ】There isの文'),
  (14, '【I】過去形'),
  (15, '【I】過去進行形'),
  (16, '【Ⅱ】5つの文構造'),
  (17, '【Ⅱ】SVCの文 (look Aなど)'),
  (18, '【Ⅱ】未来を表す文'),
  (19, '【Ⅱ】助動詞'),
  (20, '【Ⅱ】接続詞'),
  (21, '【I】不定詞'),
  (22, '【Ⅱ】動名詞'),
  (23, '【Ⅱ】SVOOの文 (give ABなど)'),
  (24, '【Ⅱ】SVOCの文 (call A Bなど)'),
  (25, '【Ⅱ】比較の文'),
  (26, '【Ⅱ】受け身の文'),
  (27, '【Ⅱ】疑問詞+to不定詞/ask+人+to不定詞'),
  (28, '【Ⅲ】It is~ (for+人) to...'),
  (29, '【Ⅲ】間接疑問文,tell+人+thatの文'),
  (30, '【Ⅲ】be動詞+形容詞+thatの文'),
  (31, '【Ⅲ】現在完了形(完了,経験)'),
  (32, '【Ⅲ】現在完了形(継続),現在完了進行形'),
  (33, '【Ⅲ】後置修飾'),
  (34, '【Ⅲ】関係代名詞(主格)'),
  (35, '【Ⅲ】関係代名詞(目的格,省略)'),
  (36, '【ⅢⅢ】let [help]+人など+動詞の原形'),
  (37, '【 】仮定法')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 6. 国語 > 東京書籍1年 漢字 (subject='国語', display_order=1) — 21 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '国語' AND cg.display_order = 1
) cg,
(VALUES
  (1,  '朗読の世界~ さまざまな表現技法'),
  (2,  '漢字道場1・文法の窓1'),
  (3,  '私たちの未来・話の~・インタビュー'),
  (4,  '漢字道場2 音読み・訓読み'),
  (5,  '日本語探検2・オオカミを~①'),
  (6,  'オオカミを~②・情報の~・「食文化」~'),
  (7,  '漢字道場3・日本語探検3・図書館~'),
  (8,  '平和のバトン①'),
  (9,  '平和のバトン 2'),
  (10, 'さんちき①'),
  (11, 'さんちき②・場面と~・案内や~'),
  (12, '日本語探検4~ 「写真」の意見文'),
  (13, '漢字道場4 漢字の部首・月夜の浜辺'),
  (14, '移り行く浦島太郎の物語・伊曽保物語'),
  (15, '竹取物語・矛盾'),
  (16, '漢字道場5形の似た漢字'),
  (17, 'ニュースの見方を考えよう~ 漢字道場6'),
  (18, '少年の日の思い出①'),
  (19, '少年の日の思い出②'),
  (20, '少年の~③・日常~・グループ~・文法の窓3'),
  (21, '漢字道場7・わたしの~・多様性と~')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 7. 国語 > 東京書籍2年 漢字 (subject='国語', display_order=2) — 20 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '国語' AND cg.display_order = 2
) cg,
(VALUES
  (1,  'あの夕暮れへ帰る~ 短歌の創作'),
  (2,  '漢字道場1同訓異字①'),
  (3,  '漢字道場1同訓異字②・文法の窓1'),
  (4,  '足跡①'),
  (5,  '足跡②・異なる~・意見と~・日本語探検1'),
  (6,  '漢字道場2漢字の意味'),
  (7,  'ネコだって推理できる~ 日本語探検2'),
  (8,  '鰹節——世界に誇る伝統食'),
  (9,  '字のない葉書・人物像・依頼状とお礼状'),
  (10, '漢字道場3・文法の窓2'),
  (11, '黄金の扇風機・サハラ砂漠の茶会①'),
  (12, 'サハラ砂漠の茶会② ~ 落葉松'),
  (13, '枕草子・徒然草、平家物語①'),
  (14, '平家物語②・漢詩'),
  (15, '日本語探検3・漢字道場5'),
  (16, '正しい~・具体と~・漢字~6・メディア~'),
  (17, '走れメロス①'),
  (18, '走れメロス②'),
  (19, '走れメロス③・短歌~・リンク~・文法の窓3'),
  (20, '漢字道場7・わたしが〜・地球環境と~')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;
