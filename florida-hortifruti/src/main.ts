import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:5176', 'http://localhost:5200'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const vercel = /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(origin);
      const listed = allowedOrigins.includes(origin);
      if (listed || vercel) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Health check público para o Render monitorar
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`API rodando em http://0.0.0.0:${port}`);
}
bootstrap();
