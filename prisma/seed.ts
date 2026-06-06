import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_RULES = [
  { name: "Mobile Deposits", direction: "Money In", matchField: "description", condition: "contains", matchValue: "BKOFAMERICA MOBILE", accountName: "Home Care Service Revenue", priority: 10 },
  { name: "ATM Deposits", direction: "Money In", matchField: "description", condition: "contains", matchValue: "BKOFAMERICA ATM", accountName: "Home Care Service Revenue", priority: 11 },
  { name: "Counter Credits", direction: "Money In", matchField: "description", condition: "contains", matchValue: "Counter Credit", accountName: "Home Care Service Revenue", priority: 12 },
  { name: "Savings Transfers", direction: "Money In", matchField: "description", condition: "contains", matchValue: "transfer from SAV", accountName: "Transfer", priority: 20 },
  { name: "Checking Transfers", direction: "Money In", matchField: "description", condition: "contains", matchValue: "transfer from CHK", accountName: "Transfer", priority: 21 },
  { name: "Staples Office", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "STAPLES", accountName: "Office expenses", priority: 30 },
  { name: "Shell Fuel", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "SHELL SERVICE", accountName: "Vehicle expenses:Vehicle gas & fuel", priority: 31 },
  { name: "Citgo Fuel", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "CITGO", accountName: "Vehicle expenses:Vehicle gas & fuel", priority: 32 },
  { name: "Comcast Internet", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "COMCAST", accountName: "Communication Expenses", priority: 33 },
  { name: "Eversource Utilities", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "EVERSOURCE", accountName: "Utilities", priority: 34 },
  { name: "New London Mutual Insurance", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "NEW LONDON MUTUAL", accountName: "Insurance", priority: 35 },
  { name: "Stop and Shop Supplies", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "STOP & SHOP", accountName: "Supplies", priority: 36 },
  { name: "Apple Subscription", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "APPLE.COM", accountName: "Office expenses", priority: 37 },
  { name: "Bank Fees", direction: "Money Out", matchField: "description", condition: "contains", matchValue: "Excess Transaction Fee", accountName: "Other business expenses:Bank and credit card fees", priority: 38 },
  { name: "Checks Payroll", direction: "Money Out", matchField: "description", condition: "startsWith", matchValue: "Check", accountName: "Payroll expenses:Wages", priority: 50 },
];

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const email = process.env.ADMIN_EMAIL || "admin@legendshomecare.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Admin",
      passwordHash,
      role: "admin",
    },
  });
  console.log(`Admin user created: ${email}`);

  // Create company settings
  await prisma.companySettings.deleteMany();
  await prisma.companySettings.create({
    data: {
      companyName: "Legends Homecare LLC",
      qboCompanyName: "Legends Homecare LLC",
      bankName: "Bank of America",
      currency: "USD",
    },
  });
  console.log("Company settings created");

  // Seed default rules (only if matching chart of accounts entries exist)
  let rulesCreated = 0;
  let rulesSkipped = 0;

  for (const ruleDef of DEFAULT_RULES) {
    // Find or create the chart of accounts entry
    let account = await prisma.chartOfAccount.findUnique({
      where: { accountName: ruleDef.accountName },
    });

    if (!account) {
      // Create a placeholder account - user should import real CoA
      account = await prisma.chartOfAccount.create({
        data: {
          accountName: ruleDef.accountName,
          accountType: ruleDef.direction === "Money In" ? "Income" : "Expense",
          isActive: true,
          notes: "Auto-created during seed. Import real Chart of Accounts to update.",
        },
      });
      console.log(`  Created placeholder account: ${ruleDef.accountName}`);
    }

    try {
      await prisma.categorizationRule.upsert({
        where: { name: ruleDef.name },
        update: {
          direction: ruleDef.direction,
          matchField: ruleDef.matchField,
          condition: ruleDef.condition,
          matchValue: ruleDef.matchValue,
          accountId: account.id,
          priority: ruleDef.priority,
        },
        create: {
          name: ruleDef.name,
          direction: ruleDef.direction,
          matchField: ruleDef.matchField,
          condition: ruleDef.condition,
          matchValue: ruleDef.matchValue,
          accountId: account.id,
          priority: ruleDef.priority,
          confidence: 0.8,
          autoApply: true,
        },
      });
      rulesCreated++;
    } catch (err) {
      console.log(`  Skipped rule: ${ruleDef.name} (${err})`);
      rulesSkipped++;
    }
  }

  console.log(`Rules: ${rulesCreated} created/updated, ${rulesSkipped} skipped`);
  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
