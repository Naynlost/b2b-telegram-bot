import { Telegraf, Markup } from 'telegraf';
import { prisma } from '../lib/prisma';
import { findStoresByPhoneNumber } from '../googleSheets';
import { sendToBottom } from '../utils/helpers';

export async function handleContactShare(ctx: any, bot: Telegraf) {
  const telegramId = ctx.from.id.toString();
  const phone = ctx.message.contact.phone_number;
  const firstName = ctx.from.first_name || "Користувач";

  const waitMsg = await ctx.reply("⏳ Перевірка номера... ");
  const stores = await findStoresByPhoneNumber(phone);

  await ctx.deleteMessage(waitMsg.message_id).catch(() => {});

  if (!stores || stores.length === 0) {
    await prisma.store.upsert({
      where: { telegramId },
      update: { phone, name: firstName, isApproved: false },
      create: { telegramId, phone, name: firstName, isApproved: false }
    });
    
    await ctx.reply("✅ Номер отримано.", Markup.removeKeyboard());

    const pitchText = `Ваш номер не знайдено в базі партнерів «Світ Хлібу» 🍞\n\n🤝 <b>Бажаєте співпрацювати з нами?</b>\nМи пропонуємо щоденну доставку свіжого хліба магазинам, вигідні ціни та знижку 10% на перше замовлення (при сумі від 1000 грн.)\n\n📞 Зателефонуйте адміністратору (Анна): +380961003966\n📩 Або натисніть кнопку нижче, щоб залишити заявку, і ми самі вам зателефонуємо.`;

    await sendToBottom(ctx, pitchText, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📝 Залишити заявку на співпрацю", "apply_partnership")],
        [Markup.button.callback("🔙 Головне меню", "back_to_main")]
      ])
    });

    const admins = await prisma.admin.findMany();
    for (const admin of admins) {
      await bot.telegram.sendMessage(
        admin.telegramId, 
        `🔔 <b>Новий потенційний партнер (Невідомий номер)!</b>\n\n👤 Telegram: ${firstName}\n📱 Телефон: ${phone}\n<i>(Клієнт зараз бачить пропозицію співпраці).</i>`, 
        { parse_mode: "HTML" }
      ).catch(() => {});
    }
    
    return; 
  }

  const defaultStore = stores[0];

  await prisma.store.upsert({
    where: { telegramId },
    update: { 
      phone, 
      name: firstName, 
      isApproved: true,
      storeName: defaultStore.storeName,
      address: defaultStore.address || "Адреса не вказана"
    },
    create: { 
      telegramId, 
      phone, 
      name: firstName, 
      isApproved: true,
      storeName: defaultStore.storeName,
      address: defaultStore.address || "Адреса не вказана"
    }
  });

  let welcomeMsg = `✅ Авторизація успішна!\n\n👋 З поверненням, <b>${defaultStore.storeName}</b>!\n📍 Адреса: ${defaultStore.address || "Не вказана"}`;
  
  if (stores.length > 1) {
    welcomeMsg = `✅ Авторизація успішна!\n\n👋 З поверненням!\nМи знайшли <b>${stores.length} магазини</b>, прив'язані до вашого номера.\n<i>(Ви зможете обрати потрібний магазин під час замовлення або перегляду балансу).</i>`;
  }

  await ctx.reply(welcomeMsg, { parse_mode: "HTML", ...Markup.removeKeyboard() });

  await sendToBottom(ctx, "🏪 <b>Оптовий відділ</b>\n📍 <i>Доставка по: Арциз, Арциз-2 (Городок), Сарата, Глинка, Маяки</i>\n\nОберіть дію:", {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("📝 Замовлення на завтра", "wholesale_order")],
      [Markup.button.callback("🔄 Повторити минуле замовлення", "wholesale_repeat")],
      [Markup.button.callback("📋 Оптовий прайс-лист", "wholesale_prices")],
      [Markup.button.callback("💵 Мій баланс", "wholesale_balance")],
      [Markup.button.callback("💬 Зв'язок з оператором", "wholesale_support")],
      [Markup.button.callback("🔙 Головне меню", "back_to_main")]
    ])
  });

  const allStoreNames = stores.map(s => s.storeName).join(', ');
  const admins = await prisma.admin.findMany();
  for (const admin of admins) {
    await bot.telegram.sendMessage(
      admin.telegramId, 
      `🔔 <b>Оптовий клієнт авторизувався!</b>\n\n🏪 Магазин(и): <b>${allStoreNames}</b>\n👤 Telegram: ${firstName}\n📱 Телефон: ${phone}`, 
      { parse_mode: "HTML" }
    ).catch(() => {});
  }
}