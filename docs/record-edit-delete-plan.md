# 授業記録 編集・削除機能 実装計画

## 概要

生徒詳細ページの「選択日の授業記録」パネルに、各レコード行から編集・削除できる UI を追加する。

---

## Phase 0: 前提条件の整理

### 現状の問題点

| 問題 | 箇所 |
|------|------|
| `lesson_records` に DELETE ポリシーがない | `supabase/schema.sql:201` |
| `lesson_records` の UPDATE が本人のみで admin 例外なし | `supabase/schema.sql:214` |
| `storage.objects` に DELETE ポリシーがない | `supabase/schema.sql:285` |
| `lesson_records.Update` 型に `lesson_date`, `step_type`, `unit_id` がない | `lib/types/supabase.ts:182` |
| 生徒詳細の select に `comment`, `instructor_id`, `score_source` がない | `students/[id]/page.tsx:135` |
| `components/ui/alert-dialog.tsx` が未追加 | `components/ui/` |

---

## Phase 1: DB Migration

**ファイル**: `supabase/migrations/YYYYMMDD_lesson_record_edit_delete.sql`

### 追加するポリシー

```sql
-- lesson_records: DELETE（本人 or admin）
CREATE POLICY "Instructors can delete own records"
  ON lesson_records FOR DELETE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- lesson_records: UPDATE を本人 or admin に拡張
DROP POLICY "Instructors can update own records" ON lesson_records;
CREATE POLICY "Instructors or admins can update records"
  ON lesson_records FOR UPDATE
  TO authenticated
  USING (
    instructor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- storage.objects: answer-sheets の DELETE
-- 注意: bucket_id 制約のみ。将来的にパス制約を追加する余地あり。
CREATE POLICY "Authenticated users can delete answer sheets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'answer-sheets');
```

---

## Phase 2: 型定義の更新

**ファイル**: `lib/types/supabase.ts`

`lesson_records.Update` に以下を追加：

```ts
Update: {
  lesson_date?: string;
  step_type?: StepType;
  unit_id?: string;
  score?: number | null;
  max_score?: number | null;
  score_source?: ScoreSource | null;
  completion_type?: CompletionType | null;
  comment?: string | null;
};
```

---

## Phase 3: API Route

**ファイル**: `app/api/lesson-records/[id]/route.ts`

route.ts を設ける理由: 画像削除・派生値再計算・認可チェックという3つの副作用を1か所に集約するため。クライアントから直接 Supabase を叩くと、これらの処理が UI 側に散らばる。

### 認可チェックの方針（共通）

`auth.getUser()` は認証状態の確認のみに使う。role は **`public.users` テーブルを参照して取得する**。現行実装（`layout.tsx:17`）と同じ流れ。

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return 401;

const { data: profile } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single();
const isAdmin = profile?.role === 'admin';
```

### `DELETE /api/lesson-records/[id]`

1. 認証チェック（`auth.getUser()`）→ 未認証なら 401
2. `lesson_records` から `instructor_id` と `record_images(id, storage_path)` を取得
3. `public.users` から role 取得 → `instructor_id !== user.id && !isAdmin` なら 403
4. `record_images` の全行の `storage_path` を配列化し、`supabase.storage.from('answer-sheets').remove(paths)` で一括削除（0件の場合はスキップ）
5. `supabase.from('lesson_records').delete().eq('id', id)` → `record_images` は CASCADE で削除される
6. 200 返却

### `PATCH /api/lesson-records/[id]`

受け付けるフィールド: `lesson_date`, `step_type`, `unit_id`, `score`, `max_score`, `comment`

#### バリデーション（サーバー側）

| 条件 | 扱い |
|------|------|
| `score` のみ指定で `max_score` が未指定 | 400: 両方セットで送ること |
| `max_score <= 0` | 400 |
| `score > max_score` | 400（採点ミスを防ぐため弾く） |
| `step_type = 'learning'` の場合 | `score`/`max_score` は null 許容（配布のみの場合があるため） |

#### 処理フロー

1. 認証・認可チェック（DELETE と同様）
2. **既存 record を DB から取得**（`step_type`, `score`, `max_score`, `record_images(ai_extracted_score, uploaded_at)` を含む）
3. `next = { ...current, ...payload }` でペイロードをマージ
4. マージ後の値で `calcCompletionType(next.step_type, next.score, next.max_score)` を呼び出し
5. `score_source` 再計算：
   - `next.score` が null → `null`
   - `record_images` が存在する場合: `uploaded_at` が最新の1件の `ai_extracted_score` を参照し、`next.score === ai_extracted_score` なら `'ai_extracted'`、違えば `'ai_corrected'`
   - `record_images` が存在しない場合: `'manual'`
6. `{ ...payload, completion_type, score_source }` で DB 更新
7. 200 返却

### 共通関数（新規）: `lib/lesson-record-utils.ts`

```ts
export function calcCompletionType(
  stepType: StepType,
  score: number | null,
  maxScore: number | null
): CompletionType | null

export function calcScoreSource(
  score: number | null,
  aiExtractedScore: number | null | undefined  // 最新画像の値
): ScoreSource | null
```

`record/page.tsx` のインライン計算もここに移す（後工程でリファクタリング）。

---

## Phase 4: UI コンポーネント

### 事前準備: `components/ui/alert-dialog.tsx` の追加

```bash
npx shadcn@latest add alert-dialog
```

削除確認に `AlertDialog`（shadcn/ui）を使う。`window.confirm` は使わない（モバイルで見た目が崩れるため）。

### コンポーネント

**ファイル**: `app/(authenticated)/students/[id]/record-actions.tsx`（新規 Client Component）

#### 構成

```
<DropdownMenu>
  <DropdownMenuTrigger> … ⋮ ボタン … </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => setEditOpen(true)}>編集</DropdownMenuItem>
    <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-destructive">削除</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<Sheet open={editOpen}>
  <SheetContent>  /* 編集フォーム */  </SheetContent>
</Sheet>

<AlertDialog open={deleteOpen}>
  <AlertDialogContent>  /* 削除確認 */  </AlertDialogContent>
</AlertDialog>
```

#### Props

```ts
interface RecordActionsProps {
  record: {
    id: string;
    lesson_date: string;
    step_type: StepType;
    score: number | null;
    max_score: number | null;
    comment: string | null;
    unit_id: string;
    instructor_id: string;
  };
  studentId: string;
  visibleUnits: Array<{ id: string; name: string; content_group_id: string }>;
  currentUserId: string;
  currentUserRole: 'admin' | 'instructor';
}
```

#### 編集フォームの項目

| フィールド | UI | 備考 |
|-----------|-----|------|
| `lesson_date` | `<input type="date">` | JST |
| `step_type` | セグメント（L / S1 / S2） | |
| `score` / `max_score` | 数値入力 2つ | `score_source` はサーバー側で自動再計算 |
| `unit_id` | セレクト | 同生徒の可視ユニットのみ（`visibleUnits` から） |
| `comment` | テキストエリア | |

#### 操作フロー

**削除:**
1. `AlertDialog` で確認（「この記録を削除しますか？取り消せません。」）
2. `DELETE /api/lesson-records/[id]`
3. `router.refresh()`

**編集:**
1. Sheet を開き、現在値を初期値としてセット
2. クライアント側バリデーション（score のみ指定・max_score <= 0・score > max_score を弾く）
3. `PATCH /api/lesson-records/[id]`（全フォーム項目を送信）
4. 成功 → Sheet を閉じて `router.refresh()`

#### 表示制御

`instructor_id === currentUserId` または `currentUserRole === 'admin'` の場合のみ ⋮ ボタンを表示。

---

## Phase 5: 生徒詳細ページへの組み込み

**ファイル**: `app/(authenticated)/students/[id]/page.tsx`

### select クエリの拡張（line 135〜）

```diff
- `id, unit_id, step_type, score, max_score, lesson_date, completion_type,
-  users!inner(display_name)`
+ `id, unit_id, step_type, score, max_score, lesson_date, completion_type,
+  comment, instructor_id, score_source,
+  users!inner(display_name)`
```

型定義も合わせて追加。

### current user の取得

Server Component なので、`public.users` テーブルから role を取得する。`auth.getUser()` の role は使わない。

```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from('users').select('role').eq('id', user!.id).single();
const currentUserRole = profile?.role ?? 'instructor';
```

### UI への差し込み（line 488〜）

```diff
  <div className="px-4 py-2.5 flex items-center gap-3">
    …既存コンテンツ…
    <span className="text-sm font-semibold tabular-nums shrink-0">
      {r.score != null ? `${r.score}/${r.max_score}` : "—"}
    </span>
+   <RecordActions
+     record={r}
+     studentId={id}
+     visibleUnits={allUnits ?? []}
+     currentUserId={user!.id}
+     currentUserRole={currentUserRole}
+   />
  </div>
```

---

## 実装順序

```
Phase 1（Migration）→ Phase 2（型）→ Phase 3（lib 共通関数 → route.ts）→ Phase 4（alert-dialog 追加 → RecordActions）→ Phase 5（page 組み込み）
```

各フェーズは独立してコミット可能。Phase 1（Migration）は本番適用が先行必須。

---

## スコープ外（第2フェーズ以降）

- 単元チップ（`students/[id]/page.tsx:621`）からのアクション：`record.id` を持たせる改修が必要
- 記録一覧ページでのバルク削除
- Storage DELETE ポリシーへのパス制約追加（現状は `bucket_id` のみ）
