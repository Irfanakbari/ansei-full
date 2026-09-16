import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // This is a worker, so we just let it run. It doesn't listen on a port.
  console.log("Printer worker service is running...");
}
bootstrap().catch((err) => {
  console.error("Error starting printer worker:", err);
  process.exit(1);
});
