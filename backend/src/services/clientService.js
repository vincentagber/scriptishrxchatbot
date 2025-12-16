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

        // CHART DATA CALCULATION: Last 7 Days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentBookings = await prisma.booking.findMany({
            where: {
                tenantId,
                status: 'Completed',
                date: { gte: sevenDaysAgo }
            },
            select: { date: true }
        });

        // Initialize last 7 days map
        const chartData = [];
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            const dayName = days[d.getDay()];
            const dateStr = d.toDateString(); // For comparison

            // Sum bookings for this day
            const dailyCount = recentBookings.filter(b => new Date(b.date).toDateString() === dateStr).length;
            const dailyIncome = dailyCount * 50; // Mock $50/booking
            // Mock expense: 40-70% of income + some noise, or random if 0 income
            const dailyExpense = dailyIncome > 0
                ? Math.floor(dailyIncome * (0.4 + Math.random() * 0.3))
                : Math.floor(Math.random() * 500) + 500;

            chartData.push({
                name: dayName,
                income: dailyIncome,
                expense: dailyExpense
            });
        }

        // Calculate total revenue
        const revenue = revenueRaw.reduce((acc, curr) => {
            // Mock logic: Wellness=50, Luggage=15, Work=25, Default=30
            const p = (curr.purpose || '').toLowerCase();
            let val = 29.99;
            if (p.includes('wellness')) val = 49.99;
            else if (p.includes('luggage')) val = 14.99;
            else if (p.includes('work')) val = 24.99;
            return acc + val;
        }, 0);

        return {
            totalClients,
            bookingsCount,
            revenue: Math.round(revenue),
            voiceInteractions: 0,
            topServices: topServices.map(s => ({
                name: s.purpose,
                count: s._count.id
            })),
            chartData // <--- Added this
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
