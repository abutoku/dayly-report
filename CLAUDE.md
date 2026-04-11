# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

営業日報システム（Sales Daily Report System）の設計ドキュメントリポジトリ。現在は設計フェーズであり、実装コードはまだ存在しない。

## Document Structure

- @docs/要件定義.md — エンティティ定義、ER図（Mermaid）、設計ポイント
- @docs/画面定義書.md — 全8画面のレイアウト、入出力項目、画面遷移図（Mermaid）
- @docs/API仕様書.md — REST API全16エンドポイントのリクエスト/レスポンス仕様
- @docs/テスト仕様書.md — 全105件のテストケース（API・画面・権限）

## Architecture

- **認証**: JWT Bearer トークン
- **API**: RESTful、ベースパス `/api/v1`
- **主要エンティティ**: salesperson（自己参照で上長関係）、customer、daily_report（problem/planカラム含む）、visit_record、comment
- **権限モデル**: 営業（自分の日報CRUD）と上長（部下の日報閲覧＋コメント、マスタ管理）の2ロール。salespersonテーブルのmanager_id自己参照で表現
- **日報構造**: 1日報に対してvisit_recordは複数件、problem/planはdaily_reportのカラム、commentは日報全体に紐づく

## Conventions

- ドキュメントは日本語で記述
- 図表はMermaid記法（erDiagram, flowchart）
- 画面IDは `SCR-XXX`、テストIDは `カテゴリ-XXX` の命名規則

## 使用技術

- **言語**: TypeScript
- **フレームワーク**: Next.js(App Router)
- **UIコンポーネント**: shadcn/ui + Tailwind CSS
- **APIスキーマ定義**: OpenAPI(Zodによる検証)
- **DBスキーマ定義**: Prisma.js
- **テスト**: Vitest
- **デプロイ**: Google Cloud Run

## Commands

- `npm run dev` — 開発サーバー起動
- `npm run build` — プロダクションビルド
- `npm run lint` — ESLint実行
- `npm run test` — Vitest実行（単発）
- `npm run test:watch` — Vitest実行（ウォッチモード）
- `npx prisma validate` — Prismaスキーマ検証
- `npx prisma migrate dev` — マイグレーション作成・適用
- `npx prisma generate` — Prisma Client生成
- `make deploy` — Cloud Runへビルド＆デプロイ（一括）
- `make deploy-build` — Dockerイメージのビルド＆プッシュのみ
- `make deploy-run` — Cloud Runへデプロイのみ
- `make setup-artifact-registry` — Artifact Registryリポジトリ作成（初回のみ）

## CI/CD

- **CI** (`.github/workflows/ci.yml`): PR・pushでlint→test→buildを実行
- **CD** (`.github/workflows/deploy.yml`): mainブランチpushでCloud Runへ自動デプロイ
- GitHub Secretsに `WIF_PROVIDER` と `WIF_SERVICE_ACCOUNT` の設定が必要
