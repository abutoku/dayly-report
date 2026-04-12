import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"]!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // パスワードハッシュ生成
  const hash = await bcrypt.hash("password123", 10);

  // --- 営業担当者 ---
  // 上長 1名
  const manager = await prisma.salesperson.upsert({
    where: { email: "suzuki@example.com" },
    update: {},
    create: {
      name: "鈴木部長",
      email: "suzuki@example.com",
      passwordHash: hash,
      isActive: true,
    },
  });

  // 部下 2名
  const tanaka = await prisma.salesperson.upsert({
    where: { email: "tanaka@example.com" },
    update: {},
    create: {
      name: "田中太郎",
      email: "tanaka@example.com",
      passwordHash: hash,
      managerId: manager.id,
      isActive: true,
    },
  });

  const yamada = await prisma.salesperson.upsert({
    where: { email: "yamada@example.com" },
    update: {},
    create: {
      name: "山田花子",
      email: "yamada@example.com",
      passwordHash: hash,
      managerId: manager.id,
      isActive: true,
    },
  });

  // --- 顧客 3社 ---
  const customerA = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "A商事",
      address: "東京都千代田区丸の内1-1-1",
      phone: "03-1234-5678",
      isActive: true,
    },
  });

  const customerB = await prisma.customer.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "B工業",
      address: "大阪府大阪市北区梅田2-2-2",
      phone: "06-2345-6789",
      isActive: true,
    },
  });

  const customerC = await prisma.customer.upsert({
    where: { id: 3 },
    update: {},
    create: {
      name: "C物産",
      address: "名古屋市中区栄3-3-3",
      phone: "052-3456-7890",
      isActive: true,
    },
  });

  const customers = [customerA, customerB, customerC];

  // --- 既存のシードデータをクリーンアップ（冪等性確保） ---
  await prisma.comment.deleteMany();
  await prisma.visitRecord.deleteMany();
  await prisma.dailyReport.deleteMany();

  // --- 過去3日分の日報 (田中) ---
  const today = new Date();
  for (let daysAgo = 1; daysAgo <= 3; daysAgo++) {
    const reportDate = new Date(today);
    reportDate.setDate(today.getDate() - daysAgo);
    // 日付のみ（時刻を0にリセット）
    reportDate.setHours(0, 0, 0, 0);

    const status = daysAgo === 1 ? "draft" : "submitted";

    const report = await prisma.dailyReport.upsert({
      where: {
        salespersonId_reportDate: {
          salespersonId: tanaka.id,
          reportDate,
        },
      },
      update: {},
      create: {
        salespersonId: tanaka.id,
        reportDate,
        problem:
          daysAgo === 1
            ? null
            : `${customers[daysAgo - 1].name}の見積について要相談`,
        plan:
          daysAgo === 1
            ? null
            : `${customers[daysAgo - 1].name}への提案資料を作成`,
        status,
      },
    });

    // 各日報に訪問記録を2件ずつ
    const visitTimes = ["09:00", "14:00"];
    for (let v = 0; v < 2; v++) {
      const customer = customers[(daysAgo + v) % customers.length];
      const [hours, minutes] = visitTimes[v].split(":").map(Number);
      const visitTime = new Date(1970, 0, 1, hours, minutes, 0);

      await prisma.visitRecord.create({
        data: {
          dailyReportId: report.id,
          customerId: customer.id,
          visitTime,
          content: `${customer.name}を訪問。${v === 0 ? "新規提案の打合せ" : "定期フォロー"}を実施。`,
        },
      });
    }

    // 提出済み日報には上長コメントを付与
    if (status === "submitted") {
      await prisma.comment.create({
        data: {
          dailyReportId: report.id,
          commenterId: manager.id,
          content: "確認しました。引き続きよろしくお願いします。",
        },
      });
    }
  }

  // --- 過去2日分の日報 (山田) ---
  for (let daysAgo = 1; daysAgo <= 2; daysAgo++) {
    const reportDate = new Date(today);
    reportDate.setDate(today.getDate() - daysAgo);
    reportDate.setHours(0, 0, 0, 0);

    const report = await prisma.dailyReport.upsert({
      where: {
        salespersonId_reportDate: {
          salespersonId: yamada.id,
          reportDate,
        },
      },
      update: {},
      create: {
        salespersonId: yamada.id,
        reportDate,
        problem: `${customers[daysAgo - 1].name}のクレーム対応が必要`,
        plan: `${customers[daysAgo - 1].name}への対応方針を検討`,
        status: "submitted",
      },
    });

    const [hours, minutes] = "10:30".split(":").map(Number);
    const visitTime = new Date(1970, 0, 1, hours, minutes, 0);

    await prisma.visitRecord.create({
      data: {
        dailyReportId: report.id,
        customerId: customers[daysAgo - 1].id,
        visitTime,
        content: `${customers[daysAgo - 1].name}を訪問。状況ヒアリングを実施。`,
      },
    });

    await prisma.comment.create({
      data: {
        dailyReportId: report.id,
        commenterId: manager.id,
        content: "対応方針について明日相談しましょう。",
      },
    });
  }

  console.log("seed: サンプルデータを投入しました");
  console.log(
    `  営業担当者: ${manager.name}(上長), ${tanaka.name}, ${yamada.name}`,
  );
  console.log(`  顧客: ${customers.map((c) => c.name).join(", ")}`);
  console.log("  日報: 田中 3日分, 山田 2日分");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
