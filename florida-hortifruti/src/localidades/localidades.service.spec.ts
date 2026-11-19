import { describe, expect, it } from 'vitest';
import { criarPrismaMock } from '../test-utils/prisma-mock';
import { LocalidadesService } from './localidades.service';

describe('LocalidadesService', () => {
  it('lista estados e cidades', async () => {
    const prisma = criarPrismaMock();
    const service = new LocalidadesService(prisma as any);
    await service.findEstados();
    expect(prisma.estado.findMany).toHaveBeenCalled();
    await expect(service.findCidadesPorEstado('SP')).rejects.toThrow('Estado não encontrado');
    prisma.estado.findUnique.mockResolvedValue({ id: 'SP' });
    prisma.cidade.findMany.mockResolvedValue([{ id: 'c' }]);
    expect(await service.findCidadesPorEstado('SP')).toEqual([{ id: 'c' }]);
  });
});
