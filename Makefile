PROJECT_ID := zippy-facility-492308-f2
REGION := asia-northeast1
SERVICE := dayly-report
REPO := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(SERVICE)/app
TAG := $(shell git rev-parse --short HEAD)

.PHONY: dev build lint test deploy deploy-build deploy-run setup-artifact-registry

# --- ローカル開発 ---

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

test:
	npm run test

# --- デプロイ ---

## Artifact Registry にリポジトリを作成（初回のみ）
setup-artifact-registry:
	gcloud artifacts repositories create $(SERVICE) \
		--repository-format=docker \
		--location=$(REGION) \
		--project=$(PROJECT_ID)

## Cloud Build でイメージをビルド＆プッシュ
deploy-build:
	gcloud builds submit \
		--tag $(REPO):$(TAG) \
		--project $(PROJECT_ID)

## Cloud Run にデプロイ
deploy-run:
	gcloud run deploy $(SERVICE) \
		--image $(REPO):$(TAG) \
		--region $(REGION) \
		--project $(PROJECT_ID) \
		--platform managed \
		--allow-unauthenticated

## ビルド＆デプロイ（一括実行）
deploy: deploy-build deploy-run
