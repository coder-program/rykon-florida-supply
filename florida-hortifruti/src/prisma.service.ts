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

  private readonly retryableConnectionCodes = new Set([
    'P1001',
    'P1017',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ]);

  private async reconnectWithBackoff(attempt = 0) {
    const maxRetries = Number(process.env.PRISMA_RETRY_MAX ?? 3);
    const baseDelayMs = Number(process.env.PRISMA_RETRY_DELAY_MS ?? 500);

    if (attempt >= maxRetries) return false;

    await this.$disconnect().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    await this.$connect().catch(() => undefined);

    return true;
  }

  constructor() {
    super();

    this.$use(async (params, next) => {
      const maxRetries = Number(process.env.PRISMA_RETRY_MAX ?? 3);
      const baseDelayMs = Number(process.env.PRISMA_RETRY_DELAY_MS ?? 500);
      const isReadQuery = this.retryableReadActions.has(params.action);

      let attempt = 0;
      while (true) {
        try {
          return await next(params);
        } catch (error: any) {
          const code = String(error?.code ?? '');
          const message = String(error?.message ?? '');
          const connectionClosed =
            message.includes('Server has closed the connection') ||
            message.includes('Connection terminated unexpectedly') ||
            message.includes('connect ECONNRESET') ||
            message.includes('closed the connection') ||
            message.includes('Connection pool timeout');
          const retryableCode =
            this.retryableConnectionCodes.has(code) || code.startsWith('P1') || connectionClosed;
          const shouldRetry = (isReadQuery || retryableCode) && attempt < maxRetries;

          if (!shouldRetry) {
            throw error;
          }

          attempt += 1;
          const waitMs = baseDelayMs * attempt;

          await this.$disconnect().catch(() => undefined);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          await this.$connect().catch(() => undefined);
        }
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      await this.reconnectWithBackoff(0);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
