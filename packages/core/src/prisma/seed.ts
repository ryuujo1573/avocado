/**
 * Seed script — creates one org + one operator user + one enrollment token
 * for local development and CI.
 *
 * Run with: bun packages/core/src/prisma/seed.ts
 */
import { PrismaClient } from "./generated/client/index.js";

const db = new PrismaClient();

async function main() {
  const orgName = process.env.SEED_ORG_NAME ?? "Avocado Dev Org";
  const userEmail = process.env.SEED_USER_EMAIL ?? "operator@avocado.local";
  const userPassword = process.env.SEED_USER_PASSWORD ?? "avocado-dev-2026";
  const tokenValue = process.env.SEED_ENROLLMENT_TOKEN ?? "enroll-dev-token-1";

  const passwordHash = await Bun.password.hash(userPassword, {
    algorithm: "bcrypt",
    cost: 12,
  });

  const org = await db.org.upsert({
    where: { id: "seed-org-1" },
    update: {},
    create: {
      id: "seed-org-1",
      name: orgName,
    },
  });

  const user = await db.user.upsert({
    where: { email: userEmail },
    update: {},
    create: {
      orgId: org.id,
      email: userEmail,
      passwordHash,
      name: "Seed Operator",
      role: "operator",
    },
  });

  // Enrollment token valid for 30 days
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const token = await db.enrollmentToken.upsert({
    where: { token: tokenValue },
    update: { expiresAt },
    create: {
      orgId: org.id,
      token: tokenValue,
      expiresAt,
    },
  });

  console.info("Seed complete:");
  console.info("  Org:   ", org.id, org.name);
  console.info("  User:  ", user.email, "(password:", userPassword, ")");
  console.info(
    "  Token: ",
    token.token,
    "(expires:",
    expiresAt.toISOString(),
    ")",
  );
  console.info();
  console.info("Agent CLI command:");
  console.info(
    `  avocado-agent --server http://localhost:3000 --enroll ${token.token}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
