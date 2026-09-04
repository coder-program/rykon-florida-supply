import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

@Injectable()
export class StorageService {
  constructor(private config: ConfigService) {}

  private uploadsDir() {
    const dir = this.config.get<string>('UPLOADS_DIR') || join(process.cwd(), 'uploads');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  async salvarImagem(buffer: Buffer, mime = 'image/jpeg'): Promise<string> {
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const nome = `${randomUUID()}.${ext}`;
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const bucket = this.config.get<string>('S3_BUCKET');

    if (endpoint && bucket) {
      return this.salvarS3(buffer, nome, mime);
    }

    const pasta = join(this.uploadsDir(), 'comprovantes');
    if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true });
    await pipeline(Readable.from(buffer), createWriteStream(join(pasta, nome)));
    return `/uploads/comprovantes/${nome}`;
  }

  async salvarDataUrl(dataUrl: string): Promise<string> {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw new Error('Imagem inválida');
    const buffer = Buffer.from(match[2], 'base64');
    return this.salvarImagem(buffer, match[1]);
  }

  private async salvarS3(buffer: Buffer, nome: string, mime: string): Promise<string> {
    const endpoint = this.config.get<string>('S3_ENDPOINT')!;
    const bucket = this.config.get<string>('S3_BUCKET')!;
    const accessKey = this.config.get<string>('S3_ACCESS_KEY') ?? '';
    const secretKey = this.config.get<string>('S3_SECRET_KEY') ?? '';
    const publicUrl =
      this.config.get<string>('S3_PUBLIC_URL') || `${endpoint.replace(/\/$/, '')}/${bucket}`;
    const key = `comprovantes/${nome}`;
    const url = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;

    const crypto = await import('crypto');
    const date = new Date().toUTCString();
    const stringToSign = `PUT\n\n${mime}\n${date}\n/${bucket}/${key}`;
    const signature = crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Date: date,
        'Content-Type': mime,
        Authorization: `AWS ${accessKey}:${signature}`,
      },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) {
      throw new Error(`Falha ao enviar arquivo ao storage (${res.status})`);
    }
    return `${publicUrl.replace(/\/$/, '')}/${key}`;
  }
}
