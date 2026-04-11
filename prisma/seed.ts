// 営業日報システム シードスクリプトのひな型
//
// TODO: 次のIssueでマスタデータの投入を実装する
// - PrismaClient (driver adapter 経由) の初期化
// - 営業担当者・顧客・日報のサンプルデータ作成
//
// 実行方法 (次のIssueで `prisma.config.ts` の `migrations.seed` に登録予定):
//   npx prisma db seed

async function main() {
  console.log("seed: ひな型のため、現時点ではデータ投入を行いません");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
