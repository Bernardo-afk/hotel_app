import { create, list, decide, whatsappResponse } from './maintenance-tickets.service';
import { prisma } from '../../lib/prisma';
import { sendPush } from '../notifications/notifications.service';

jest.mock('../../lib/prisma', () => ({
  prisma: {
    property: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    maintenanceTicket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../notifications/notifications.service', () => ({
  sendPush: jest.fn(),
}));

const tenantId = 'tenant-1';
const ticketId = 'ticket-1';
const propertyId = 'property-1';

const mockProperty = { id: propertyId, tenantId };

const mockTicket = {
  id: ticketId,
  tenantId,
  propertyId,
  status: 'OPEN',
  description: 'Broken faucet',
  incidentId: null,
  resolvedAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── create ──────────────────────────────────────────────────────────────────

describe('create', () => {
  test('creates ticket with status OPEN', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue(mockProperty);
    (prisma.maintenanceTicket.create as jest.Mock).mockResolvedValue(mockTicket);

    const result = await create(tenantId, { propertyId, description: 'Broken faucet' });

    expect(result).toEqual(mockTicket);
    expect(result.status).toBe('OPEN');
    expect(prisma.maintenanceTicket.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId, propertyId, description: 'Broken faucet' }),
    });
  });

  test('throws 404 if property not found', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(create(tenantId, { propertyId, description: 'test' })).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prisma.maintenanceTicket.create).not.toHaveBeenCalled();
  });

  test('property lookup always includes tenantId', async () => {
    (prisma.property.findFirst as jest.Mock).mockResolvedValue(mockProperty);
    (prisma.maintenanceTicket.create as jest.Mock).mockResolvedValue(mockTicket);

    await create(tenantId, { propertyId, description: 'test' });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyId, tenantId },
    });
  });
});

// ── list ─────────────────────────────────────────────────────────────────────

describe('list', () => {
  test('always queries with tenantId', async () => {
    (prisma.maintenanceTicket.findMany as jest.Mock).mockResolvedValue([mockTicket]);

    const result = await list(tenantId);

    expect(result).toEqual([mockTicket]);
    expect(prisma.maintenanceTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
      }),
    );
  });
});

// ── decide ────────────────────────────────────────────────────────────────────

describe('decide', () => {
  test('throws 404 if ticket not found', async () => {
    (prisma.maintenanceTicket.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(decide(tenantId, ticketId, 'RESOLVED')).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prisma.maintenanceTicket.updateMany).not.toHaveBeenCalled();
  });

  test('sets resolvedAt when status is RESOLVED', async () => {
    const resolvedTicket = { ...mockTicket, status: 'RESOLVED', resolvedAt: new Date(), property: mockProperty };
    (prisma.maintenanceTicket.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockTicket)    // existence check
      .mockResolvedValueOnce(resolvedTicket); // return after update
    (prisma.maintenanceTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await decide(tenantId, ticketId, 'RESOLVED');

    expect(prisma.maintenanceTicket.updateMany).toHaveBeenCalledWith({
      where: { id: ticketId, tenantId },
      data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
    });
    expect(result).toEqual(resolvedTicket);
  });

  test('does not set resolvedAt for non-RESOLVED status', async () => {
    const pendingTicket = { ...mockTicket, status: 'PENDING', property: mockProperty };
    (prisma.maintenanceTicket.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockTicket)
      .mockResolvedValueOnce(pendingTicket);
    (prisma.maintenanceTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    await decide(tenantId, ticketId, 'PENDING');

    expect(prisma.maintenanceTicket.updateMany).toHaveBeenCalledWith({
      where: { id: ticketId, tenantId },
      data: expect.objectContaining({ status: 'PENDING', resolvedAt: undefined }),
    });
  });

  test('blocks property and notifies admins on WONT_FIX', async () => {
    const wontFixTicket = { ...mockTicket, status: 'WONT_FIX', property: mockProperty };
    const adm = { id: 'adm-1', fcmToken: 'token-adm', role: 'ADM' };
    const superAdm = { id: 'super-1', fcmToken: 'token-super', role: 'SUPER_ADMIN' };

    (prisma.maintenanceTicket.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockTicket)
      .mockResolvedValueOnce(wontFixTicket);
    (prisma.maintenanceTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.property.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findMany as jest.Mock)
      .mockResolvedValueOnce([superAdm])   // SUPER_ADMIN query
      .mockResolvedValueOnce([adm]);       // ADM query
    (sendPush as jest.Mock).mockResolvedValue(undefined);

    await decide(tenantId, ticketId, 'WONT_FIX');

    expect(prisma.property.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: propertyId, tenantId }),
        data: expect.objectContaining({ status: 'BLOCKED' }),
      }),
    );
    expect(sendPush).toHaveBeenCalledTimes(2);
  });

  test('does not call sendPush when WONT_FIX users have no fcmToken', async () => {
    const wontFixTicket = { ...mockTicket, status: 'WONT_FIX', property: mockProperty };
    const userNoToken = { id: 'adm-1', fcmToken: null, role: 'ADM' };

    (prisma.maintenanceTicket.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockTicket)
      .mockResolvedValueOnce(wontFixTicket);
    (prisma.maintenanceTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.property.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([userNoToken]);
    (sendPush as jest.Mock).mockResolvedValue(undefined);

    await decide(tenantId, ticketId, 'WONT_FIX');

    expect(sendPush).not.toHaveBeenCalled();
  });
});

// ── whatsappResponse ──────────────────────────────────────────────────────────

describe('whatsappResponse', () => {
  test('returns matched:false when user not found', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await whatsappResponse('+5511999999999', 'sim');

    expect(result).toEqual({ matched: false });
    expect(prisma.maintenanceTicket.updateMany).not.toHaveBeenCalled();
  });

  test('updates tickets and returns matched:true when user found', async () => {
    const user = { id: 'user-1', tenantId, whatsappNumber: '+5511999999999' };
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (prisma.maintenanceTicket.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await whatsappResponse('+5511999999999', 'sim');

    expect(result).toEqual({ matched: true });
    expect(prisma.maintenanceTicket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId }),
        data: expect.objectContaining({ whatsappResponse: 'sim' }),
      }),
    );
  });
});
