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

-- 8. 英語 > 英文法 入門 (subject='英語', display_order=4) — 84 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '英語' AND cg.display_order = 4
) cg,
(VALUES
  (1,  '【I】文のきまり①'),
  (2,  '【I】I am. You are ~.'),
  (3,  '【I】Are you ~?'),
  (4,  '【I】am not~. You are not ~.'),
  (5,  '【I】まとめ問題①(Iam~. You are ~.)'),
  (6,  '【I】This is ~. That is'),
  (7,  '【I】Is this~? Is that ~?'),
  (8,  '【I】This is not ~. That is not ~.'),
  (9,  '【I】This is a/an/the~.(冠詞)'),
  (10, '【I】まとめ問題② (This is ~. That is ~.)'),
  (11, '【I】He is. She is ~.'),
  (12, '【I】Is he~? Is she ~?'),
  (13, '【I】He is not ~. She is not ~.'),
  (14, '【I】まとめ問題③ (He is ~. She is ~.)'),
  (15, '【I】be動詞(現在形)のまとめ'),
  (16, '【I】I have ~.(一般動詞)'),
  (17, '【I】Do you ~? (一般動詞の疑問文)'),
  (18, '【I】I don''t~. (一般動詞の否定文)'),
  (19, '【I】まとめ問題④(一般動詞)'),
  (20, '【I】be動詞+形容詞'),
  (21, '【I】What is ~?'),
  (22, '【I】What do you ~?'),
  (23, '【I】副詞'),
  (24, '【I】まとめ問題⑤(形容詞、副詞,what)'),
  (25, '【I】名詞の複数形'),
  (26, '【I】We are. They are ~.'),
  (27, '【I】How many ~?'),
  (28, '【I】someとany'),
  (29, '【I】まとめ問題⑥(複数形)'),
  (30, '【I】命令文'),
  (31, '【I】感嘆文'),
  (32, '【I】まとめ問題⑦(命令文,感嘆文)'),
  (33, '【I】文のきまり②'),
  (34, '【I】He plays~. She plays ~. (3人称・単数・現在)'),
  (35, '【I】Does he ~? Does she ~? (3・単・現の疑問文)'),
  (36, '【I】He doesn''t~. She doesn''t ~. (3・単・現の否定文)'),
  (37, '【I】まとめ問題⑧(3人称・単数・現在)'),
  (38, '【I】一般動詞(現在形)のまとめ'),
  (39, '【I】Who is~?'),
  (40, '【I】時刻・曜日をたずねる文'),
  (41, '【I】Where is~?'),
  (42, '【I】Whose ~?'),
  (43, '【I】When do you ~?'),
  (44, '【I】まとめ問題⑨(who, where, whose, when)'),
  (45, '【I】Which is ~?'),
  (46, '【I】How is~?'),
  (47, '【I】him [her], me [you] を使った文'),
  (48, '【I】us, themを使った文'),
  (49, '【I】まとめ問題10(which, how, 代名詞の目的格)'),
  (50, '【I】代名詞のまとめ'),
  (51, '【I】am ~ing(現在進行形)'),
  (52, '【I】Are you ~ing?(現在進行形の疑問文)'),
  (53, '【I】I am not ~ing(現在進行形の否定文)'),
  (54, '【I】What are you ~ing?'),
  (55, '【I】まとめ問題①①(現在進行形)'),
  (56, '【I】want to ~の文'),
  (57, '【I】want to ~の疑問文、否定文'),
  (58, '【I】like~ingなどの文'),
  (59, '【I】look+形容詞の文'),
  (60, '【I】まとめ問題 12 (want to ~, like ~ing, look A)'),
  (61, '【I】I can~.'),
  (62, '【I】Can you ~?'),
  (63, '【I】I cannot ~.'),
  (64, '【I】まとめ問題 13 (canの文)'),
  (65, '【I】I played~ (規則動詞の過去形)'),
  (66, '【I】Did you ~? (過去の疑問文)'),
  (67, '【I】I didn''t ~. (過去の否定文)'),
  (68, '【I】went~(不規則動詞の過去形)'),
  (69, '【I】まとめ問題 (一般動詞の過去形)'),
  (70, '【I】be動詞の過去形'),
  (71, '【I】be動詞の過去形(疑問文)'),
  (72, '【I】be動詞の過去形(否定文)'),
  (73, '【I】まとめ問題 15 (be動詞の過去形)'),
  (74, '【I】I was ~ing(過去進行形)'),
  (75, '【I】Were you~ing?(過去進行形の疑問文)'),
  (76, '【I】I was not ~ing (過去進行形の否定文)'),
  (77, '【I】What were you ~ing?'),
  (78, '【I】まとめ問題 (過去進行形)'),
  (79, '【I】前置詞'),
  (80, '【I】There is ~. There are ~.'),
  (81, '【I】Is there~? Are there ~?'),
  (82, '【I】There is not~. There are not any ~.'),
  (83, '【I】How many ~ are there...?'),
  (84, '【I】まとめ問題 (前置詞,There is~.)')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 9. 数学 > 1年[共通版] (subject='数学', display_order=3) — 74 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '数学' AND cg.display_order = 3
) cg,
(VALUES
  (1,  '正の数と負の数'),
  (2,  '絶対値・数の大小の関係'),
  (3,  '正負の数の加法①(整数)'),
  (4,  '正負の数の加法②(小数・分数)'),
  (5,  '正負の数の減法①(整数)'),
  (6,  '正負の数の減法②(小数・分数)'),
  (7,  '正負の数の加法と減法①(かっこのある加減)'),
  (8,  '正負の数の加法と減法②(かっこのない加減)'),
  (9,  '正負の数の乗法①(整数)'),
  (10, '正負の数の乗法②(小数・分数)'),
  (11, '累乗と指数'),
  (12, '素数の積'),
  (13, '正負の数の除法'),
  (14, '正負の数の乗法と除法'),
  (15, '正負の数の四則計算①(整数)'),
  (16, '正負の数の四則計算②(分数)'),
  (17, '正負の数の四則計算③(分配法則)'),
  (18, '正負の数の応用問題'),
  (19, '文字を使った式'),
  (20, '文字式のきまり'),
  (21, '文字式 数量の表し方①(代金・長さ、単位)'),
  (22, '文字式 数量の表し方 ②(面積・体積、速さ)'),
  (23, '文字式 数量の表し方 ③ (割合)'),
  (24, '文字式 数量の表し方 ④ (食塩水)【発展】'),
  (25, '式の意味・式の値'),
  (26, '文字式の加法と減法① (整数係数)'),
  (27, '文字式の加法と減法② (小数・分数係数)'),
  (28, '文字式の加法と減法③ (かっこのある整数係数)'),
  (29, '文字式の加法と減法④ (かっこのある小数・分数係数)'),
  (30, '文字式の加法と減法まとめ練習'),
  (31, '文字式の乗法と除法①'),
  (32, '文字式の乗法と除法②'),
  (33, '文字式のいろいろな計算① (計算・分配)'),
  (34, '文字式のいろいろな計算② (分数式の和と差)'),
  (35, '等式・不等式'),
  (36, '方程式とその解'),
  (37, '方程式の解き方①(整数係数)'),
  (38, '方程式の解き方② (かっこのある式)'),
  (39, '方程式の解き方 ③ (小数・分数係数)'),
  (40, '方程式の利用①(代金,数)'),
  (41, '方程式の利用②(分配,過不足)'),
  (42, '方程式の利用③(速さ)'),
  (43, '方程式の利用④(利益,食塩水)【発展】'),
  (44, '比例式'),
  (45, '関数と比例'),
  (46, '比例のグラフ'),
  (47, '比例のグラフと式'),
  (48, '反比例'),
  (49, '反比例のグラフと式'),
  (50, '変域とグラフ 【発展】'),
  (51, '比例・反比例の利用'),
  (52, '平面図形の基礎'),
  (53, '平行移動'),
  (54, '回転移動'),
  (55, '対称移動'),
  (56, '円とおうぎ形'),
  (57, '垂直二等分線'),
  (58, '角の二等分線'),
  (59, 'いろいろな作図'),
  (60, 'いろいろな立体'),
  (61, '正多面体'),
  (62, '直線と平面の位置関係'),
  (63, '展開図・回転体'),
  (64, '投影図'),
  (65, '柱とすいの体積'),
  (66, '柱とすいの表面積'),
  (67, '球'),
  (68, '度数分布表'),
  (69, 'ヒストグラム、度数折れ線'),
  (70, '相対度数,代表値'),
  (71, '確率'),
  (72, '不等式【発展】'),
  (73, '平面図形・空間図形【発展】'),
  (74, '座標と図形【発展】')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 10. 数学 > 2年[共通版] (subject='数学', display_order=4) — 49 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '数学' AND cg.display_order = 4
) cg,
(VALUES
  (1,  '単項式と多項式、式の加法と減法'),
  (2,  'いろいろな式の計算①(分配法則)'),
  (3,  'いろいろな式の計算②(分数の形の式)'),
  (4,  '単項式の乗法と除法'),
  (5,  '単項式の乗法と除法が混じった計算'),
  (6,  '式の値'),
  (7,  '文字を使った説明'),
  (8,  '等式の変形'),
  (9,  '連立方程式①(考え方)'),
  (10, '連立方程式②(加減法)'),
  (11, '連立方程式③(代入法)'),
  (12, '連立方程式④(練習)'),
  (13, '連立方程式⑤ (いろいろな計算)'),
  (14, '連立方程式⑥(小数・分数係数)'),
  (15, '連立方程式の利用①(数、代金)'),
  (16, '連立方程式の利用②(速さ・基本)'),
  (17, '連立方程式の利用③(速さ・応用)'),
  (18, '連立方程式の利用④(割合)'),
  (19, '1次関数と変化の割合'),
  (20, '1次関数のグラフ'),
  (21, '直線の式'),
  (22, '2元1次方程式のグラフ'),
  (23, '1次関数のグラフ・応用問題'),
  (24, '1次関数の利用'),
  (25, '平行線と同位角・錯角'),
  (26, '三角形と角①(内角の和、外角)'),
  (27, '三角形と角②(内角と外角の応用)'),
  (28, '多角形と角'),
  (29, '合同と証明'),
  (30, '合同の証明'),
  (31, '合同【記述】'),
  (32, '二等辺三角形の性質'),
  (33, '二等辺三角形の証明'),
  (34, '正三角形の証明'),
  (35, '二等辺三角形・正三角形【記述】'),
  (36, '二等辺三角形・正三角形と角度'),
  (37, '直角三角形と合同'),
  (38, '直角三角形と合同 【記述】'),
  (39, '平行四辺形の性質'),
  (40, '平行四辺形の性質【記述】'),
  (41, '平行四辺形と証明'),
  (42, '平行四辺形と証明【記述】'),
  (43, '平行線と面積'),
  (44, '場合の数・組み合わせ'),
  (45, '確率の求め方'),
  (46, 'いろいろな確率'),
  (47, 'データの活用'),
  (48, '式と計算、方程式【発展】'),
  (49, '場合の数【発展】')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 11. 理科 > 小学4年 理科 (subject='理科', display_order=1) — 18 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '理科' AND cg.display_order = 1
) cg,
(VALUES
  (1,  '季節と生き物①(春の動物と植物)'),
  (2,  '季節と生き物②(夏の動物と植物)'),
  (3,  '季節と生き物③(秋の動物と植物)'),
  (4,  '季節と生き物④(冬の動物と植物)'),
  (5,  '天気と気温'),
  (6,  '電気のはたらき'),
  (7,  '月や星の見え方①(夏の夜空)'),
  (8,  '月や星の見え方②(月と星の位置の変化)'),
  (9,  '月や星の見え方③(冬の夜空)'),
  (10, 'とじこめた空気や水'),
  (11, '人の体のつくりと運動'),
  (12, '水のゆくえ①(水の流れとしみこみ)'),
  (13, '水のゆくえ②(空気中の水)'),
  (14, '実験用ガスこんろ、アルコールランプの使い方'),
  (15, 'ものの体積と温度'),
  (16, 'もののあたたまり方'),
  (17, '水のすがた①(水を熱したとき)'),
  (18, '水のすがた②(水を冷やしたとき、水の3つのすがた)')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 12. 理科 > 小学5年 理科 (subject='理科', display_order=2) — 12 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '理科' AND cg.display_order = 2
) cg,
(VALUES
  (1,  'けんび鏡の使い方'),
  (2,  '種子の発芽と植物の成長'),
  (3,  '花のつくりと実のでき方'),
  (4,  'メダカのたんじょう'),
  (5,  '人のたんじょう'),
  (6,  '雲と天気'),
  (7,  '台風と天気'),
  (8,  '流れる水のはたらき'),
  (9,  'もののとけ方'),
  (10, 'とけたもののとり出し方'),
  (11, 'ふりこの動き'),
  (12, '電流と電磁石')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 13. 理科 > 小学6年 理科 (subject='理科', display_order=3) — 14 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '理科' AND cg.display_order = 3
) cg,
(VALUES
  (1,  'ものの燃え方と空気'),
  (2,  '植物と日光'),
  (3,  '植物と水'),
  (4,  '消化のはたらき'),
  (5,  '呼吸と血液のはたらき'),
  (6,  '生物どうしのかかわり'),
  (7,  '月の形と太陽'),
  (8,  '大地のつくりと変化'),
  (9,  '水溶液の性質'),
  (10, '水溶液と金属'),
  (11, 'てこのはたらき'),
  (12, 'てこを利用した道具'),
  (13, '電気の利用'),
  (14, '生物と環境')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 14. 理科 > 理科1年 (subject='理科', display_order=4) — 25 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '理科' AND cg.display_order = 4
) cg,
(VALUES
  (1,  '光の反射・屈折'),
  (2,  'レンズ'),
  (3,  '音'),
  (4,  '力のはたらき、力の大きさとばね'),
  (5,  '力の表し方、重さと質量'),
  (6,  '力のつり合い'),
  (7,  '実験の基本操作'),
  (8,  '密度'),
  (9,  '気体'),
  (10, '水溶液・濃度'),
  (11, '溶解度'),
  (12, '状態変化'),
  (13, '蒸留'),
  (14, '物質の加熱と変化'),
  (15, '身近な生物の観察'),
  (16, '顕微鏡'),
  (17, '花のつくりとはたらき'),
  (18, '被子植物の根と葉のようす'),
  (19, '種子植物の分類'),
  (20, '胞子でふえる植物、植物の分類'),
  (21, 'セキツイ動物'),
  (22, '無セキツイ動物'),
  (23, '火山・火成岩'),
  (24, '地震'),
  (25, '堆積岩と地層')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;

-- 15. 理科 > 入門 1年 (subject='理科', display_order=5) — 25 units
INSERT INTO units (content_group_id, name, unit_number)
SELECT cg.id, u.name, u.unit_number
FROM (
  SELECT cg.id FROM content_groups cg
  JOIN subjects s ON s.id = cg.subject_id
  WHERE s.name = '理科' AND cg.display_order = 5
) cg,
(VALUES
  (1,  '光の反射・屈折'),
  (2,  'レンズ'),
  (3,  '音'),
  (4,  '力のはたらき、力の大きさとばね'),
  (5,  '力の表し方、重さと質量'),
  (6,  '力のつり合い'),
  (7,  '実験の基本操作'),
  (8,  '物質の性質'),
  (9,  '密度'),
  (10, '気体'),
  (11, '水溶液・濃度'),
  (12, '溶解度'),
  (13, '状態変化'),
  (14, '蒸留'),
  (15, '身近な生物の観察'),
  (16, '顕微鏡'),
  (17, '花のつくりとはたらき'),
  (18, '被子植物の根と葉のようす'),
  (19, '種子植物の分類'),
  (20, '胞子でふえる植物、植物の分類'),
  (21, 'セキツイ動物'),
  (22, '無セキツイ動物'),
  (23, '火山,火成岩'),
  (24, '地震'),
  (25, '堆積岩と地層')
) AS u(unit_number, name)
ON CONFLICT (content_group_id, unit_number) DO NOTHING;
