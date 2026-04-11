# 営業日報システム API仕様書

## 共通仕様

### ベースURL

```
/api/v1
```

### 認証

- JWT Bearer トークンによる認証
- ログインAPI以外のすべてのエンドポイントで `Authorization: Bearer <token>` ヘッダーが必要

### 共通レスポンス形式

**成功時**

```json
{
  "data": { ... }
}
```

**一覧取得時**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

**エラー時**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "報告日は必須です",
    "details": [ ... ]
  }
}
```

### 共通エラーコード

| HTTPステータス | コード           | 説明                             |
| -------------- | ---------------- | -------------------------------- |
| 400            | VALIDATION_ERROR | バリデーションエラー             |
| 401            | UNAUTHORIZED     | 未認証                           |
| 403            | FORBIDDEN        | 権限不足                         |
| 404            | NOT_FOUND        | リソースが見つからない           |
| 409            | CONFLICT         | 重複エラー（同一日付の日報など） |
| 500            | INTERNAL_ERROR   | サーバーエラー                   |

---

## API一覧

| #   | メソッド | エンドポイント        | 概要         | 権限                     |
| --- | -------- | --------------------- | ------------ | ------------------------ |
| 1   | POST     | /auth/login           | ログイン     | 不要                     |
| 2   | POST     | /auth/logout          | ログアウト   | 全員                     |
| 3   | GET      | /reports              | 日報一覧取得 | 全員                     |
| 4   | POST     | /reports              | 日報作成     | 営業                     |
| 5   | GET      | /reports/:id          | 日報詳細取得 | 全員                     |
| 6   | PUT      | /reports/:id          | 日報更新     | 営業（本人）             |
| 7   | DELETE   | /reports/:id          | 日報削除     | 営業（本人・下書きのみ） |
| 8   | POST     | /reports/:id/comments | コメント投稿 | 上長                     |
| 9   | GET      | /customers            | 顧客一覧取得 | 全員                     |
| 10  | POST     | /customers            | 顧客登録     | 全員                     |
| 11  | GET      | /customers/:id        | 顧客詳細取得 | 全員                     |
| 12  | PUT      | /customers/:id        | 顧客更新     | 全員                     |
| 13  | GET      | /salespersons         | 営業一覧取得 | 上長                     |
| 14  | POST     | /salespersons         | 営業登録     | 上長                     |
| 15  | GET      | /salespersons/:id     | 営業詳細取得 | 上長                     |
| 16  | PUT      | /salespersons/:id     | 営業更新     | 上長                     |

---

## 1. 認証

### POST /auth/login

ログイン認証を行い、JWTトークンを返却する。

**リクエスト**

```json
{
  "email": "tanaka@example.com",
  "password": "password123"
}
```

| パラメータ | 型     | 必須 | 説明           |
| ---------- | ------ | ---- | -------------- |
| email      | string | o    | メールアドレス |
| password   | string | o    | パスワード     |

**レスポンス (200)**

```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "salesperson": {
      "id": 1,
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "is_manager": true
    }
  }
}
```

**エラー (401)**

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "メールアドレスまたはパスワードが正しくありません"
  }
}
```

---

### POST /auth/logout

ログアウト処理を行う。

**レスポンス (204)** No Content

---

## 2. 日報

### GET /reports

日報一覧を取得する。営業は自分の日報のみ、上長は部下の日報も取得可能。

**クエリパラメータ**

| パラメータ     | 型                  | 必須 | 説明                                    |
| -------------- | ------------------- | ---- | --------------------------------------- |
| date_from      | string (YYYY-MM-DD) | -    | 報告日の開始日                          |
| date_to        | string (YYYY-MM-DD) | -    | 報告日の終了日                          |
| salesperson_id | integer             | -    | 担当者ID（上長のみ指定可）              |
| status         | string              | -    | ステータス絞り込み（draft / submitted） |
| page           | integer             | -    | ページ番号（デフォルト: 1）             |
| per_page       | integer             | -    | 1ページあたりの件数（デフォルト: 20）   |

**レスポンス (200)**

```json
{
  "data": [
    {
      "id": 1,
      "report_date": "2026-04-04",
      "salesperson": {
        "id": 1,
        "name": "田中太郎"
      },
      "visit_count": 3,
      "status": "submitted",
      "created_at": "2026-04-04T17:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

### POST /reports

日報を新規作成する。訪問記録・Problem・Planをまとめて登録する。

**リクエスト**

```json
{
  "report_date": "2026-04-04",
  "problem": "A商事の見積について、特別値引きの承認が必要。",
  "plan": "A商事への見積作成、B工業への議事録送付",
  "status": "submitted",
  "visits": [
    {
      "customer_id": 1,
      "visit_time": "09:00",
      "content": "新規提案の打合せ。見積依頼あり。"
    },
    {
      "customer_id": 2,
      "visit_time": "11:00",
      "content": "定期フォロー。次回は来月予定。"
    }
  ]
}
```

| パラメータ           | 型                  | 必須 | 説明                                  |
| -------------------- | ------------------- | ---- | ------------------------------------- |
| report_date          | string (YYYY-MM-DD) | o    | 報告日                                |
| problem              | string              | -    | 課題・相談                            |
| plan                 | string              | -    | 明日やること                          |
| status               | string              | o    | "draft" または "submitted"            |
| visits               | array               | -    | 訪問記録の配列（提出時は1件以上必須） |
| visits[].customer_id | integer             | o    | 顧客ID                                |
| visits[].visit_time  | string (HH:mm)      | o    | 訪問時刻                              |
| visits[].content     | string              | o    | 訪問内容                              |

**レスポンス (201)**

```json
{
  "data": {
    "id": 1,
    "report_date": "2026-04-04",
    "problem": "A商事の見積について、特別値引きの承認が必要。",
    "plan": "A商事への見積作成、B工業への議事録送付",
    "status": "submitted",
    "visits": [
      {
        "id": 1,
        "customer": { "id": 1, "name": "A商事" },
        "visit_time": "09:00",
        "content": "新規提案の打合せ。見積依頼あり。"
      },
      {
        "id": 2,
        "customer": { "id": 2, "name": "B工業" },
        "visit_time": "11:00",
        "content": "定期フォロー。次回は来月予定。"
      }
    ],
    "created_at": "2026-04-04T17:00:00Z"
  }
}
```

**エラー (409)**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "2026-04-04 の日報は既に存在します"
  }
}
```

---

### GET /reports/:id

日報の詳細を取得する。訪問記録・コメントを含む。

**レスポンス (200)**

```json
{
  "data": {
    "id": 1,
    "report_date": "2026-04-04",
    "salesperson": {
      "id": 1,
      "name": "田中太郎"
    },
    "problem": "A商事の見積について、特別値引きの承認が必要。",
    "plan": "A商事への見積作成、B工業への議事録送付",
    "status": "submitted",
    "visits": [
      {
        "id": 1,
        "customer": { "id": 1, "name": "A商事" },
        "visit_time": "09:00",
        "content": "新規提案の打合せ。見積依頼あり。"
      },
      {
        "id": 2,
        "customer": { "id": 2, "name": "B工業" },
        "visit_time": "11:00",
        "content": "定期フォロー。次回は来月予定。"
      }
    ],
    "comments": [
      {
        "id": 1,
        "commenter": { "id": 10, "name": "鈴木部長" },
        "content": "A商事の値引きは10%まで承認します。見積を確認させてください。",
        "created_at": "2026-04-04T18:30:00Z"
      }
    ],
    "created_at": "2026-04-04T17:00:00Z",
    "updated_at": "2026-04-04T17:00:00Z"
  }
}
```

---

### PUT /reports/:id

日報を更新する。本人かつ下書きステータスの場合のみ可能。訪問記録は全件洗い替え。

**リクエスト**

```json
{
  "report_date": "2026-04-04",
  "problem": "A商事の見積について、特別値引きの承認が必要。",
  "plan": "A商事への見積作成、B工業への議事録送付",
  "status": "submitted",
  "visits": [
    {
      "customer_id": 1,
      "visit_time": "09:00",
      "content": "新規提案の打合せ。見積依頼あり。"
    },
    {
      "customer_id": 2,
      "visit_time": "11:00",
      "content": "定期フォロー。次回は来月予定。"
    },
    {
      "customer_id": 3,
      "visit_time": "14:00",
      "content": "クレーム対応。詳細は別途報告。"
    }
  ]
}
```

**レスポンス (200)** POST /reports のレスポンスと同一形式

**エラー (403)**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "提出済みの日報は編集できません"
  }
}
```

---

### DELETE /reports/:id

日報を削除する。本人かつ下書きステータスの場合のみ可能。

**レスポンス (204)** No Content

---

### POST /reports/:id/comments

日報にコメントを投稿する。上長のみ実行可能。

**リクエスト**

```json
{
  "content": "A商事の値引きは10%まで承認します。見積を確認させてください。"
}
```

| パラメータ | 型     | 必須 | 説明         |
| ---------- | ------ | ---- | ------------ |
| content    | string | o    | コメント内容 |

**レスポンス (201)**

```json
{
  "data": {
    "id": 1,
    "commenter": { "id": 10, "name": "鈴木部長" },
    "content": "A商事の値引きは10%まで承認します。見積を確認させてください。",
    "created_at": "2026-04-04T18:30:00Z"
  }
}
```

---

## 3. 顧客マスタ

### GET /customers

顧客一覧を取得する。

**クエリパラメータ**

| パラメータ | 型      | 必須 | 説明                   |
| ---------- | ------- | ---- | ---------------------- |
| name       | string  | -    | 顧客名（部分一致検索） |
| is_active  | boolean | -    | 有効フラグで絞り込み   |
| page       | integer | -    | ページ番号             |
| per_page   | integer | -    | 1ページあたりの件数    |

**レスポンス (200)**

```json
{
  "data": [
    {
      "id": 1,
      "name": "A商事",
      "address": "東京都千代田区丸の内1-1-1",
      "phone": "03-1234-5678",
      "is_active": true
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 50, "total_pages": 3 }
}
```

---

### POST /customers

顧客を新規登録する。

**リクエスト**

```json
{
  "name": "D電機",
  "address": "名古屋市中区栄1-1-1",
  "phone": "052-123-4567"
}
```

| パラメータ | 型     | 必須 | 説明     |
| ---------- | ------ | ---- | -------- |
| name       | string | o    | 顧客名   |
| address    | string | -    | 住所     |
| phone      | string | -    | 電話番号 |

**レスポンス (201)**

```json
{
  "data": {
    "id": 4,
    "name": "D電機",
    "address": "名古屋市中区栄1-1-1",
    "phone": "052-123-4567",
    "is_active": true,
    "created_at": "2026-04-04T10:00:00Z"
  }
}
```

---

### GET /customers/:id

顧客詳細を取得する。

**レスポンス (200)**

```json
{
  "data": {
    "id": 1,
    "name": "A商事",
    "address": "東京都千代田区丸の内1-1-1",
    "phone": "03-1234-5678",
    "is_active": true,
    "created_at": "2026-01-15T09:00:00Z",
    "updated_at": "2026-03-20T14:00:00Z"
  }
}
```

---

### PUT /customers/:id

顧客情報を更新する。

**リクエスト**

```json
{
  "name": "A商事株式会社",
  "address": "東京都千代田区丸の内1-1-1",
  "phone": "03-1234-5678",
  "is_active": true
}
```

**レスポンス (200)** GET /customers/:id のレスポンスと同一形式

---

## 4. 営業マスタ

### GET /salespersons

営業担当者一覧を取得する。上長のみ実行可能。

**クエリパラメータ**

| パラメータ | 型      | 必須 | 説明                 |
| ---------- | ------- | ---- | -------------------- |
| is_active  | boolean | -    | 有効フラグで絞り込み |
| page       | integer | -    | ページ番号           |
| per_page   | integer | -    | 1ページあたりの件数  |

**レスポンス (200)**

```json
{
  "data": [
    {
      "id": 1,
      "name": "田中太郎",
      "email": "tanaka@example.com",
      "manager": { "id": 10, "name": "鈴木部長" },
      "is_active": true
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 15, "total_pages": 1 }
}
```

---

### POST /salespersons

営業担当者を新規登録する。上長のみ実行可能。

**リクエスト**

```json
{
  "name": "山田花子",
  "email": "yamada@example.com",
  "password": "initial_password",
  "manager_id": 10
}
```

| パラメータ | 型      | 必須 | 説明                   |
| ---------- | ------- | ---- | ---------------------- |
| name       | string  | o    | 氏名                   |
| email      | string  | o    | メールアドレス（一意） |
| password   | string  | o    | 初期パスワード         |
| manager_id | integer | -    | 上長の営業担当者ID     |

**レスポンス (201)**

```json
{
  "data": {
    "id": 5,
    "name": "山田花子",
    "email": "yamada@example.com",
    "manager": { "id": 10, "name": "鈴木部長" },
    "is_active": true,
    "created_at": "2026-04-04T10:00:00Z"
  }
}
```

---

### GET /salespersons/:id

営業担当者の詳細を取得する。上長のみ実行可能。

**レスポンス (200)**

```json
{
  "data": {
    "id": 1,
    "name": "田中太郎",
    "email": "tanaka@example.com",
    "manager": { "id": 10, "name": "鈴木部長" },
    "is_active": true,
    "created_at": "2026-01-10T09:00:00Z",
    "updated_at": "2026-03-01T11:00:00Z"
  }
}
```

---

### PUT /salespersons/:id

営業担当者情報を更新する。上長のみ実行可能。

**リクエスト**

```json
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "manager_id": 10,
  "is_active": true
}
```

| パラメータ | 型      | 必須 | 説明                 |
| ---------- | ------- | ---- | -------------------- |
| name       | string  | o    | 氏名                 |
| email      | string  | o    | メールアドレス       |
| password   | string  | -    | 変更する場合のみ指定 |
| manager_id | integer | -    | 上長ID               |
| is_active  | boolean | -    | 有効フラグ           |

**レスポンス (200)** GET /salespersons/:id のレスポンスと同一形式
