# u-emiya.github.io
my public memo

Supabase 同期のセットアップ

1. Supabase でプロジェクトを作成する。
2. `Settings -> API` から `Project URL` と `anon key` を取得し、`supabase.js` の `SUPABASE_URL` / `SUPABASE_ANON_KEY` に設定する。
3. SQL エディタで以下のテーブルを作成する（例）：

```sql
create table bookmarks (
	id text primary key,
	url text,
	title text,
	description text,
	tags text[],
	created bigint,
	owner uuid default auth.uid()
);

create table memos (
	id text primary key,
	title text,
	content text,
	tags text[],
	link text,
	imageDataUrl text,
	created bigint,
	owner uuid default auth.uid()
);
```

4. RLS を有効にし、認証ユーザーのみ読み書きできるポリシーを作成する。例（簡易）：

```sql
-- 読み取り: 公開内でも認証ユーザーのみ
alter table bookmarks enable row level security;
create policy "authenticated read" on bookmarks for select using (auth.role() = 'authenticated');
create policy "authenticated write" on bookmarks for insert, update, delete using (auth.role() = 'authenticated');

alter table memos enable row level security;
create policy "authenticated read" on memos for select using (auth.role() = 'authenticated');
create policy "authenticated write" on memos for insert, update, delete using (auth.role() = 'authenticated');
```

5. ページでメールログイン（マジックリンク）を利用してログインし、同期ボタンでサーバーとのアップロード/ダウンロードが行えます。

注意: `SUPABASE_ANON_KEY` は公開クライアントキーであり、匿名ユーザーの API 権限は RLS で制御してください。より厳密にユーザー単位での保存をしたい場合は、テーブルに `owner` カラムを用意し、INSERT/SELECT のポリシーで `owner = auth.uid()` を使ってください。

