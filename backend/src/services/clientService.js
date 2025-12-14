const prisma = require('../lib/prisma');

class ClientService {
    async getClients(tenantId, search) {
        let where = { tenantId };

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }

        return prisma.client.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { bookings: true }
        });
    }

    async getClientStats(tenantId) {
        // Consolidated stats query
        const [totalClients, bookingsCount, revenueRaw, topServices] = await Promise.all([
            prisma.client.count({ where: { tenantId } }),
            prisma.booking.count({ where: { tenantId } }),
            prisma.booking.findMany({
                where: { tenantId, status: 'Completed' },
                select: { purpose: true }
            }),
            prisma.booking.groupBy({
                by: ['purpose'],
                where: { tenantId, purpose: { not: null } },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 5
            })
        ]);

        // Revenue Mock Calc
        const revenue = revenueRaw.length * 50;

        return {
            totalClients,
            bookingsCount,
            revenue,
            voiceInteractions: 0,
            topServices: topServices.map(s => ({
                name: s.purpose,
                count: s._count.id
            }))
        };
    }

    async createClient(tenantId, data) {
        const { name, email, phone, notes } = data;

        // potential duplicate check could go here

        return prisma.client.create({
            data: {
                tenantId,
                name,
                email,
                phone,
                notes
            }
        });
    }


    async deleteClient(tenantId, id) {
        const client = await prisma.client.findFirst({ where: { id, tenantId } });
        if (!client) throw new Error('NOT_FOUND: Client not found');

        return prisma.client.delete({ where: { id } });
    }
}

module.exports = new ClientService();
