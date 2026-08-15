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

```sql
create table if not exists bookmarks (
  id text primary key,
  url text not null,
  title text,
  description text,
  tags text[] not null default '{}',
  created bigint not null
);

create table if not exists memos (
  id text primary key,
  title text,
  content text,
  tags text[] not null default '{}',
  link text,
  image_data_url text,
  created bigint not null
);
```

## 3. RLS ポリシー（推奨）

以下の SQL の `admin1@example.com` などを実際の管理者メールに置き換えてください。

```sql
alter table bookmarks enable row level security;
alter table memos enable row level security;

create policy "bookmarks_read_all"
on bookmarks for select
using (true);

create policy "memos_read_all"
on memos for select
using (true);

create policy "bookmarks_write_admin_only"
on bookmarks for all
using (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'))
with check (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'));

create policy "memos_write_admin_only"
on memos for all
using (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'))
with check (auth.jwt() ->> 'email' in ('admin1@example.com', 'admin2@example.com'));
```

## 4. ログイン方式について

この構成では「マジックリンク」を採用しています。

- UUID 共有方式より安全で、漏えい時のリスクが低い
- Supabase 側の RLS と組み合わせやすい
- ユーザーごとのパスワード管理が不要

必要なら将来的に UUID トークン方式へ拡張できますが、現状の要件（簡単同期 + 限定書き込み）ではマジックリンクが最短です。

