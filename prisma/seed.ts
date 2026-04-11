import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // TODO: 次のIssueでマスタデータの投入を実装する
  // 例: 営業担当者・顧客・日報のサンプルデータを作成
  console.log("seed: ひな型のため、現時点ではデータ投入を行いません");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
