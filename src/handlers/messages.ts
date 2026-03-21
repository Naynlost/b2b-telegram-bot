import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { prisma } from '../lib/prisma';
import { wholesaleCarts } from '../store/cartStore';
import { renderWholesaleCart } from '../views/wholesaleView';
import { processWholesaleOrder } from '../services/wholesaleService';


export function setupMessageHandlers(bot: Telegraf) {
  bot.on(message('text'), async (ctx, next) => {
    if (ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message) {
      const isAdmin = await prisma.admin.findUnique({ where: { telegramId: ctx.from.id.toString() } });
      if (isAdmin) {
        const idMatch = ctx.message.reply_to_message.text.match(/🆔 (\d+)/);
        if (idMatch && idMatch[1]) {
          try {
            await bot.telegram.sendMessage(idMatch[1], `👨‍💻 <b>Відповідь від адміністратора:</b>\n\n💬 <i>${ctx.message.text}</i>\n\n(Щоб відповісти, знову натисніть кнопку зв'язку з оператором)`, { parse_mode: "HTML" });
            return ctx.reply("✅ Відповідь успішно надіслана клієнту.");
          } catch (err) {
            return ctx.reply("❌ Помилка: Не вдалося надіслати повідомлення.");
          }
        }
      }
    }

    const session = (ctx as any).session;
    if (!session) return next();

    if (session.waitingForQty) {
      const qty = parseInt(ctx.message.text);
      if (isNaN(qty) || qty < 0) return ctx.reply("❌ Будь ласка, введіть правильне число.");
      const telegramId = ctx.from.id.toString();
      const productId = parseInt(session.editProductId);
      let cart = wholesaleCarts.get(telegramId) || {};
      if (qty === 0) delete cart[productId]; else cart[productId] = qty;
      wholesaleCarts.set(telegramId, cart);
      
      const categoryId = parseInt(session.editCategoryId);
      const page = parseInt(session.editPage || 0); 
      
      (ctx as any).session = null;
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply(`✅ Оновлено: ${qty} шт.`);
      
      return renderWholesaleCart(ctx, telegramId, categoryId, page);
    }
    if (session.waitingForPreorder) {
      const telegramId = ctx.from.id.toString();
      const storeName = session.preorderStore;
      (ctx as any).session = null;
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply(`✅ Ваше замовлення прийнято!\n📍 <b>Магазин:</b> ${storeName}\n\nПродавець відкладе товар для вас.`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Головне меню", "back_to_main")]]) });
      const admins = await prisma.admin.findMany();
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId, `🛍 <b>Нове попереднє замовлення (Роздріб):</b>\n👤 Клієнт: ${ctx.from.first_name || "Користувач"}\n🆔 ${telegramId}\n📍 <b>Магазин:</b> ${storeName}\n\n📝 <i>${ctx.message.text}</i>`, { parse_mode: "HTML" }).catch(() => {});
      }
      return;
    }

    if (session.waitingForFeedback) {
      const telegramId = ctx.from.id.toString();
      (ctx as any).session = null;
      await ctx.reply("✅ Дякуємо! Ваш відгук передано адміністрації.");
      const admins = await prisma.admin.findMany();
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId, `📩 <b>Новий відгук (Роздріб):</b>\n👤 Від: ${ctx.from.first_name || "Користувач"}\n🆔 ${telegramId}\n\n📝 <i>${ctx.message.text}</i>`, { parse_mode: "HTML" }).catch(() => {});
      }
      return;
    }

    if (session.waitingForSupport) {
      const telegramId = ctx.from.id.toString();
      const store = await prisma.store.findUnique({ where: { telegramId } });
      (ctx as any).session = null;
      await ctx.reply(
        "✅ Ваше повідомлення передано оператору. Очікуйте на відповідь.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Головне меню", "back_to_main")]
        ])
      );
      const admins = await prisma.admin.findMany();
      for (const admin of admins) {
        await bot.telegram.sendMessage(admin.telegramId, `🆘 <b>Повідомлення оператору (Опт):</b>\n🏪 Клієнт: ${store?.name || ctx.from.first_name}\n📱 Телефон: ${store?.phone || "Немає"}\n🆔 ${telegramId}\n\n💬 <i>${ctx.message.text}</i>`, { parse_mode: "HTML" }).catch(() => {});
      }
      return;
}

    if (session.waitingForStoreName) {
      (ctx as any).session = { waitingForStoreAddress: true, tempStoreName: ctx.message.text };
      await ctx.deleteMessage().catch(() => {});
      return ctx.reply("🗺 <b>Адреса магазину:</b>\nТепер напишіть <b>адресу вашого магазину</b>:", { parse_mode: "HTML", ...Markup.forceReply().placeholder("Адреса...") });
    }

    if (session.waitingForStoreAddress) {
      const telegramId = ctx.from.id.toString();
      const updatedStore = await prisma.store.update({ where: { telegramId }, data: { storeName: session.tempStoreName, address: ctx.message.text } });
      (ctx as any).session = null;
      await ctx.deleteMessage().catch(() => {});
      await processWholesaleOrder(ctx, telegramId, updatedStore, bot);
      return;
    }

    return next();
  });
}