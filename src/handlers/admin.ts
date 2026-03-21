import { Telegraf } from 'telegraf';
import { prisma } from '../lib/prisma';

export function setupAdminHandlers(bot: Telegraf) {

  bot.command('admin', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const admin = await prisma.admin.findUnique({ where: { telegramId } });
    
    if (!admin) return ctx.reply("❌ У вас немає прав адміністратора.");

    // Veritabanından anlık log çekiyoruz
    const totalStores = await prisma.store.count({ where: { isApproved: true } });
    const recentOrders = await prisma.order.findMany({
      take: 5, // Son 5 siparişi getir
      orderBy: { createdAt: 'desc' },
      include: { store: true }
    });

    let logText = `📊 <b>Системні Логи та Статистика</b>\n\n`;
    logText += `🏪 <b>Активних магазинів у базі:</b> ${totalStores}\n\n`;
    logText += `📋 <b>Останні 5 дій (Замовлення):</b>\n`;

    if (recentOrders.length === 0) {
      logText += "<i>Ще немає замовлень.</i>";
    } else {
      recentOrders.forEach((o, index) => {
        // Sipariş saati ve detayları
        const time = o.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute:'2-digit' });
        logText += `${index + 1}. [${time}] <b>${o.store?.storeName || 'Невідомо'}</b> оформив замовлення на ${o.total}₴\n`;
      });
    }

    logText += `\n💡 <i>Живі логи (хто куди натискає, хто переглядає ціни) надсилаються вам автоматично в цей чат.</i>`;

    await ctx.reply(logText, { parse_mode: "HTML" });
  });
}