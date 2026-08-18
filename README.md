# u-emiya.github.io

Supabase を使った同期構成（JSON ファイルなし）

このサイトは以下の構成です。

- 閲覧: だれでも可能
- 書き込み: マジックリンクでログインした「管理者メールアドレス」のみ
- 同期: ブックマーク/メモは直接 Supabase テーブルへ保存

## 1. フロント設定

`supabase.js` を設定してください。

- `SUPABASE_URL`: 例 `https://xxxx.supabase.co`
- `SUPABASE_ANON_KEY`: publishable / anon key
- `ADMIN_EMAIL_ALLOWLIST`: 書き込み許可メール

## 2. テーブル作成

初回作成だけでなく再実行時の安全性も考慮し、`if not exists` と列補完（`add column if not exists`）を併用します。

```sql
begin;

create table if not exists bookmarks (
  id text primary key,
  url text not null,
  title text,
  description text,
  tags text[] not null default '{}',
  created bigint not null
);

alter table bookmarks add column if not exists title text;
alter table bookmarks add column if not exists description text;
alter table bookmarks add column if not exists tags text[] not null default '{}';
alter table bookmarks add column if not exists created bigint;

create table if not exists memos (
  id text primary key,
  title text,
  content text,
  tags text[] not null default '{}',
  link text,
  image_data_url text,
  created bigint not null
);

alter table memos add column if not exists title text;
alter table memos add column if not exists content text;
alter table memos add column if not exists tags text[] not null default '{}';
alter table memos add column if not exists link text;
alter table memos add column if not exists image_data_url text;
alter table memos add column if not exists created bigint;

create table if not exists manga_bookmarks (
  id text primary key,
  url text not null,
  title text,
  description text,
  tags text[] not null default '{}',
  created bigint not null
);

alter table manga_bookmarks add column if not exists title text;
alter table manga_bookmarks add column if not exists description text;
alter table manga_bookmarks add column if not exists tags text[] not null default '{}';
alter table manga_bookmarks add column if not exists created bigint;

commit;
```

### 2-1. 既存データを移行する場合（任意）

以前の実装で `bookmarks` テーブルに「漫画」タグ付きで保存していた場合は、次の SQL で `manga_bookmarks` へ移行できます。

```sql
insert into manga_bookmarks (id, url, title, description, tags, created)
select id, url, title, description,
       coalesce(array_remove(tags, '漫画'), '{}') as tags,
       created
from bookmarks
where '漫画' = any(tags)
on conflict (id) do nothing;
```

## 3. Supabase 側で入れるべきもの（Auth URL 設定）

このプロジェクトでは `supabase.js` 内で `emailRedirectTo` を `auth.html` に固定しています。
そのため、Supabase 側には `auth.html` を Redirect URL として登録してください。

### 3-1. 入力する場所

1. Supabase ダッシュボードを開く
2. 対象プロジェクトを選ぶ
3. 左メニューから Authentication を開く
4. URL Configuration（または同等の URL 設定画面）を開く

### 3-2. Site URL

- 用途: 認証フローの基準 URL
- 推奨値: 本番公開サイトのルート

例

- GitHub Pages の場合: `https://<ユーザー名>.github.io/<リポジトリ名>/`
- 独自ドメインの場合: `https://example.com/`

### 3-3. Redirect URLs

- 用途: マジックリンクで戻ってくる URL の許可リスト
- 必須: `emailRedirectTo` で指定される URL を必ず含める

このプロジェクトで許可すべき代表例

- `https://<ユーザー名>.github.io/<リポジトリ名>/auth.html`
- （独自ドメイン運用時）`https://<独自ドメイン>/auth.html`

運用を簡単にする場合（ワイルドカード許可）

- `https://<ユーザー名>.github.io/<リポジトリ名>/*`

ローカル検証を行う場合

- `http://localhost:5500/*`
- `http://127.0.0.1:5500/*`

使っているローカルサーバーのポートに合わせて調整してください。

### 3-4. 失敗時のチェックポイント

- `SUPABASE_URL` は `https://<project-ref>.supabase.co` 形式か
- `SUPABASE_URL` に `/rest/v1/` が付いていないか
- Redirect URLs に、実際に開いているページ URL が含まれているか
- URL の末尾スラッシュ有無が許可設定とずれていないか
- HTTP/HTTPS が一致しているか

`Invalid path specified in request URL` が出る場合は、特に `SUPABASE_URL` と Redirect URLs の不一致を確認してください。

## 4. RLS ポリシー（推奨）

以下の SQL の `admin1@example.com` などを実際の管理者メールに置き換えてください。
この手順は「再実行しても失敗しにくい差分適用」を目的に、既存 policy を明示的に入れ替える構成にしています。

```sql
begin;

alter table bookmarks enable row level security;
alter table memos enable row level security;
alter table manga_bookmarks enable row level security;

drop policy if exists "bookmarks_read_all" on bookmarks;
create policy "bookmarks_read_all"
on bookmarks for select
using (true);

drop policy if exists "memos_read_all" on memos;
create policy "memos_read_all"
on memos for select
using (true);

drop policy if exists "manga_bookmarks_read_all" on manga_bookmarks;
create policy "manga_bookmarks_read_all"
on manga_bookmarks for select
using (true);

drop policy if exists "bookmarks_write_admin_only" on bookmarks;
create policy "bookmarks_write_admin_only"
on bookmarks for all
using (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'))
with check (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'));

drop policy if exists "memos_write_admin_only" on memos;
create policy "memos_write_admin_only"
on memos for all
using (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'))
with check (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'));

drop policy if exists "manga_bookmarks_write_admin_only" on manga_bookmarks;
create policy "manga_bookmarks_write_admin_only"
on manga_bookmarks for all
using (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'))
with check (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'));

commit;
```

## 5. ログイン方式について

この構成では「マジックリンク」を採用しています。

- UUID 共有方式より安全で、漏えい時のリスクが低い
- Supabase 側の RLS と組み合わせやすい
- ユーザーごとのパスワード管理が不要

必要なら将来的に UUID トークン方式へ拡張できますが、現状の要件（簡単同期 + 限定書き込み）ではマジックリンクが最短です。

