import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create a test pipeline
  const testPipeline = await prisma.pipeline.upsert({
    where: { name: "Test Pipeline" },
    update: {},
    create: {
      name: "Test Pipeline",
      description: "Initial test pipeline for development",
      isActive: true,
    },
  });

  console.log("✅ Test Pipeline created:", testPipeline);

  // Create a test webhook
  const testWebhook = await prisma.webhook.upsert({
    where: {
      id: "test-webhook-1",
    },
    update: {},
    create: {
      id: "test-webhook-1",
      pipelineId: testPipeline.id,
      eventType: "order.created",
      url: "http://localhost:3000/webhooks/order",
      isActive: true,
    },
  });

  console.log("✅ Test Webhook created:", testWebhook);

  // Create a test task
  const testTask = await prisma.task.create({
    data: {
      pipelineId: testPipeline.id,
      webhookId: testWebhook.id,
      status: "pending",
      payload: {
        eventType: "order.created",
        orderId: "ORD-12345",
        amount: 99.99,
      },
      maxAttempts: 3,
    },
  });

  console.log("✅ Test Task created:", testTask);

  console.log("✨ Seed completed successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
