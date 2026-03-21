import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { prisma } from '../lib/prisma';
import { wholesaleCarts } from '../store/cartStore';
import { sendToBottom } from '../utils/helpers';
import { handleContactShare } from '../services/authService';

export function setupMainHandlers(bot: Telegraf) {
  // --- 1. ANA EKRAN ---
  bot.start(async (ctx) => {
    await ctx.reply(
      "👋 Вітаємо в нашій пекарні! Оберіть ваш тип клієнта:\n",
      Markup.inlineKeyboard([
        [Markup.button.callback("🛒 Для покупців ", "flow_retail")],
        [Markup.button.callback("🏪 Для партнерів ", "flow_wholesale")]
      ])
    );
  });

  // --- 2. TOPTAN AKIŞI  ---
  bot.action("flow_wholesale", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });

    if (!store || !store.isApproved) {
      await ctx.deleteMessage().catch(() => {});
      await ctx.reply(
        "🔐 Для доступу до оптових цін та замовлень, будь ласка, авторизуйтесь.\n",
        Markup.keyboard([Markup.button.contactRequest("📱 Надіслати номер ")]).resize().oneTime()
      );
    } else {
      await sendToBottom(ctx, "🏪 <b>Оптовий відділ</b>\n📍 <i>Доставка по: Арциз, Арциз-2 (Городок), Сарата, Глинка, Маяки</i>\n\nОберіть дію:", {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📝 Замовлення на завтра", "wholesale_order")],
          [Markup.button.callback("🔄 Повторити минуле замовлення", "wholesale_repeat")],
          [Markup.button.callback("📋 Наявний прайс-лист", "wholesale_prices")],
          [Markup.button.callback("💵 Мої замовлення", "wholesale_balance")],
          [Markup.button.callback("💬 Написати оператору", "wholesale_support")],
          [Markup.button.callback("🔙 Головне меню", "back_to_main")]
        ])
      });
    }
  });

  // --- 3. TOPTANCI GÜVENLİK VE OTOMATİK KAYIT ---
  bot.on(message('contact'), async (ctx) => {

    await handleContactShare(ctx, bot);
  });

  bot.action("apply_partnership", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });

    await sendToBottom(ctx, "✅ <b>Вашу заявку на співпрацю успішно надіслано!</b>\nНаш менеджер незабаром зателефонує вам для обговорення деталей.", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Головне меню", "back_to_main")]])
    });

    const admins = await prisma.admin.findMany();
    for (const admin of admins) {
      await bot.telegram.sendMessage(
        admin.telegramId, 
        `🚀 <b>НОВА ЗАЯВКА НА СПІВПРАЦЮ!</b>\n\n👤 Клієнт: ${store?.name || ctx.from.first_name}\n📱 Телефон: <code>${store?.phone || "Немає"}</code>\n🆔 ${telegramId}\n\n<i>Зателефонуйте клієнту, щоб обговорити умови співпраці та додати його до таблиці.</i>`, 
        { parse_mode: "HTML" }
      ).catch(() => {});
    }
  });

  // --- 4. NAVİGASYON ---
  bot.action("back_to_main", async (ctx) => {
    await ctx.answerCbQuery();
    await sendToBottom(ctx, "👋 Вітаємо в нашій пекарні! Оберіть ваш тип клієнта:", Markup.inlineKeyboard([
      [Markup.button.callback("🛒 Для покупців ", "flow_retail")],
      [Markup.button.callback("🏪 Для партнерів ", "flow_wholesale")]
    ]));
  });

  bot.action("back_to_wholesale_menu", async (ctx) => {
    await ctx.answerCbQuery();
    wholesaleCarts.delete(ctx.from.id.toString());
    
    await sendToBottom(ctx, "🏪 <b>Оптовий відділ</b>\n📍 <i>Доставка по: Арциз, Арциз-2 (Городок), Сарата, Глинка, Маяки</i>\n\nОберіть дію:", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📝 Замовлення на завтра", "wholesale_order")],
        [Markup.button.callback("🔄 Повторити минуле замовлення", "wholesale_repeat")],
        [Markup.button.callback("📋 Наявний прайс-лист", "wholesale_prices")],
        [Markup.button.callback("💵 Мої замовлення", "wholesale_balance")],
        [Markup.button.callback("💬 Написати оператору", "wholesale_support")],
        [Markup.button.callback("🔙 Головне меню", "back_to_main")]
      ])
    });
  });

  bot.action("ignore_click", async (ctx) => { 
    await ctx.answerCbQuery(); 
  });
}