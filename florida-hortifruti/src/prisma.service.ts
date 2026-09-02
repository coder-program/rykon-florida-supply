import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Serviço único do Prisma, injetado em todos os módulos que precisam de banco.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly retryableReadActions = new Set([
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
  ]);

  constructor() {
    super();

    this.$use(async (params, next) => {
      const maxRetries = Number(process.env.PRISMA_RETRY_MAX ?? 2);
      const baseDelayMs = Number(process.env.PRISMA_RETRY_DELAY_MS ?? 300);
      const isReadQuery = this.retryableReadActions.has(params.action);

      let attempt = 0;
      while (true) {
        try {
          return await next(params);
        } catch (error: any) {
          const code = error?.code as string | undefined;
          const retryableCode = code === 'P1001' || code === 'P1017';
          const shouldRetry = isReadQuery && retryableCode && attempt < maxRetries;

          if (!shouldRetry) {
            throw error;
          }

          attempt += 1;
          const waitMs = baseDelayMs * attempt;

          await this.$disconnect().catch(() => undefined);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          await this.$connect();
        }
      }
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
