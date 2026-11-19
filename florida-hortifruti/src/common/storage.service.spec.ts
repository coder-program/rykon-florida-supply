import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

const config = (valores: Record<string, string | undefined>) =>
  ({ get: (k: string) => valores[k] }) as any;

describe('StorageService', () => {
  const pastas: string[] = [];
  afterEach(() => {
    vi.unstubAllGlobals();
    pastas.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true }));
  });

  it('salva no disco com a extensão do tipo', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'upl-')), 'novo');
    pastas.push(dir);
    const s = new StorageService(config({ UPLOADS_DIR: dir }));
    const png = await s.salvarImagem(Buffer.from('a'), 'image/png');
    expect(png).toMatch(/^\/uploads\/comprovantes\/.+\.png$/);
    expect(readFileSync(join(dir, png.replace('/uploads/', ''))).toString()).toBe('a');
    expect(await s.salvarImagem(Buffer.from('b'), 'image/webp')).toMatch(/\.webp$/);
    expect(await s.salvarImagem(Buffer.from('c'))).toMatch(/\.jpg$/);
  });

  it('sem UPLOADS_DIR usa a pasta uploads do projeto', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'cwd-'));
    pastas.push(cwd);
    vi.spyOn(process, 'cwd').mockReturnValue(cwd);
    await new StorageService(config({})).salvarImagem(Buffer.from('a'));
    expect(existsSync(join(cwd, 'uploads', 'comprovantes'))).toBe(true);
    vi.mocked(process.cwd).mockRestore();
  });

  it('data URL: valida e decodifica', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'upl-'));
    pastas.push(dir);
    const s = new StorageService(config({ UPLOADS_DIR: dir }));
    await expect(s.salvarDataUrl('lixo')).rejects.toThrow('Imagem inválida');
    const url = await s.salvarDataUrl(
      `data:image/png;base64,${Buffer.from('oi').toString('base64')}`,
    );
    expect(readFileSync(join(dir, url.replace('/uploads/', ''))).toString()).toBe('oi');
  });

  it('envia para o S3 quando configurado', async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const s = new StorageService(
      config({
        S3_ENDPOINT: 'https://s3.x/',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
      }),
    );
    const url = await s.salvarImagem(Buffer.from('a'), 'image/png');
    expect(url).toMatch(/^https:\/\/s3\.x\/b\/comprovantes\/.+\.png$/);
    const [destino, opcoes] = fetch.mock.calls[0] as any;
    expect(destino).toBe(url);
    expect(opcoes.headers.Authorization).toMatch(/^AWS k:/);

    const comPublica = new StorageService(
      config({ S3_ENDPOINT: 'https://s3.x', S3_BUCKET: 'b', S3_PUBLIC_URL: 'https://cdn.x/' }),
    );
    expect(await comPublica.salvarImagem(Buffer.from('a'))).toMatch(
      /^https:\/\/cdn\.x\/comprovantes\//,
    );

    fetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(comPublica.salvarImagem(Buffer.from('a'))).rejects.toThrow('(403)');
  });
});
