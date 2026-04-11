-- CreateTable
CREATE TABLE "salespersons" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "manager_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salespersons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" SERIAL NOT NULL,
    "salesperson_id" INTEGER NOT NULL,
    "report_date" DATE NOT NULL,
    "problem" TEXT,
    "plan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_records" (
    "id" SERIAL NOT NULL,
    "daily_report_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "visit_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" SERIAL NOT NULL,
    "daily_report_id" INTEGER NOT NULL,
    "commenter_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salespersons_email_key" ON "salespersons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_salesperson_id_report_date_key" ON "daily_reports"("salesperson_id", "report_date");

-- AddForeignKey
ALTER TABLE "salespersons" ADD CONSTRAINT "salespersons_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "salespersons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_commenter_id_fkey" FOREIGN KEY ("commenter_id") REFERENCES "salespersons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
