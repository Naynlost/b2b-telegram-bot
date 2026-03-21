import { Telegraf, Markup } from 'telegraf';
import { prisma } from '../lib/prisma';
import { wholesaleCarts } from '../store/cartStore';
import { sendToBottom } from '../utils/helpers';
import { renderCategoriesMenu, renderWholesaleCart, renderWholesalePrices, renderCategoryPrices } from '../views/wholesaleView';
import { processWholesaleOrder, handleWholesaleBalance, handleWholesaleHistoryDetail } from '../services/wholesaleService';
import { findStoresByPhoneNumber, getStoreHistoryFromSheets } from '../googleSheets';

// ---  Arşivden Son Siparişi Fiyatlarıyla Çekme ---
async function handleRepeatFromSheetMenu(ctx: any, store: any) {
  const historyData = await getStoreHistoryFromSheets(store.storeName);

  if (!historyData || Object.keys(historyData).length === 0) {
    return sendToBottom(ctx, `📭 У магазину <b>${store.storeName}</b> ще немає попередніх замовлень в архіві.\n`, {
      parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад ", "back_to_wholesale_menu")]])
    });
  }

  const dates = Object.keys(historyData);
  const lastDate = dates[dates.length - 1]; 
  const lastOrderItems = historyData[lastDate];

  let orderText = `🔄 <b>Ваше останнє замовлення з архіву:</b>\n📅 Дата: ${lastDate}\n🏪 Магазин: ${store.storeName}\n\n`;
  let totalSum = 0;

  lastOrderItems.forEach((item: any) => { 
    orderText += `▪️ ${item.product} — ${item.qty} шт. (${item.totalAmount} ₴)\n`; 
    totalSum += parseFloat(item.totalAmount.replace(',', '.')) || 0;
  });

  orderText += `\n💰 <b>Загальна сума: ${totalSum.toFixed(2)} ₴</b>`;

  await sendToBottom(ctx, orderText + "\n\n<i>Бажаєте повторити це замовлення?</i>", {
    parse_mode: "HTML", ...Markup.inlineKeyboard([
      [Markup.button.callback("✅ Так, відправити ", "ws_do_sheet_repeat")], 
      [Markup.button.callback("🔙 Назад ", "back_to_wholesale_menu")]
    ])
  });
}

export function setupWholesaleHandlers(bot: Telegraf) {
  
  // --- 1. YENİ SİPARİŞ VER  ---
  bot.action("wholesale_order", async (ctx) => {
    await ctx.answerCbQuery("Перевірка... ", { show_alert: false });
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });

    if (store && store.phone) {
      const stores = await findStoresByPhoneNumber(store.phone);
      if (stores && stores.length > 1) {
        (ctx as any).session = { ...((ctx as any).session || {}), tempStores: stores };
        const buttons = stores.map((s, index) => [Markup.button.callback(`🏪 ${s.storeName}`, `ws_sel_ord_${index}`)]);
        buttons.push([Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]);
        return sendToBottom(ctx, "🛒 <b>Оберіть магазин для замовлення:</b>", { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
      }
    }
    await renderCategoriesMenu(ctx);
  });

  bot.action(/ws_sel_ord_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const index = parseInt(ctx.match[1]);
    const session = (ctx as any).session;
    if (!session || !session.tempStores || !session.tempStores[index]) return ctx.reply("❌ Помилка сесії.");

    const selectedStore = session.tempStores[index];
    const telegramId = ctx.from.id.toString();
    await prisma.store.update({ where: { telegramId }, data: { storeName: selectedStore.storeName, address: selectedStore.address } });
    await renderCategoriesMenu(ctx);
  });

  // --- 2. BAKİYE VE GEÇMİŞ  ---
  bot.action("wholesale_balance", async (ctx) => {
    await ctx.answerCbQuery("Завантаження...", { show_alert: false });
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });

    if (store && store.phone) {
      const stores = await findStoresByPhoneNumber(store.phone);
      if (stores && stores.length > 1) {
        (ctx as any).session = { ...((ctx as any).session || {}), tempStores: stores };
        const buttons = stores.map((s, index) => [Markup.button.callback(`📊 ${s.storeName}`, `ws_sel_bal_${index}`)]);
        buttons.push([Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]);
        return sendToBottom(ctx, "📊 <b>Оберіть магазин для перегляду балансу:</b>", { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
      }
    }

    if (!store || !store.storeName) return sendToBottom(ctx, "❌ Спочатку зробіть замовлення.", { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]]) });
    await handleWholesaleBalance(ctx, telegramId, store, bot);
  });

  bot.action(/ws_sel_bal_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const index = parseInt(ctx.match[1]);
    const session = (ctx as any).session;
    if (!session || !session.tempStores || !session.tempStores[index]) return ctx.reply("❌ Помилка сесії.");

    const selectedStore = session.tempStores[index];
    const telegramId = ctx.from.id.toString();
    const updatedStore = await prisma.store.update({ where: { telegramId }, data: { storeName: selectedStore.storeName, address: selectedStore.address } });
    await handleWholesaleBalance(ctx, telegramId, updatedStore, bot);
  });

  // --- 3. GEÇMİŞİ TEKRARLA  ---
  bot.action("wholesale_repeat", async (ctx) => {
    await ctx.answerCbQuery("Пошук в архіві...", { show_alert: false });
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });

    if (store && store.phone) {
      const stores = await findStoresByPhoneNumber(store.phone);
      if (stores && stores.length > 1) {
        (ctx as any).session = { ...((ctx as any).session || {}), tempStores: stores };
        const buttons = stores.map((s, index) => [Markup.button.callback(`🔄 ${s.storeName}`, `ws_sel_rep_${index}`)]);
        buttons.push([Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]);
        return sendToBottom(ctx, "🔄 <b>Оберіть магазин для повторення замовлення:</b>", { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
      }
    }

    if (!store || !store.storeName) return sendToBottom(ctx, "❌ Спочатку зробіть замовлення.", { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]]) });
    await handleRepeatFromSheetMenu(ctx, store);
  });

  bot.action(/ws_sel_rep_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const index = parseInt(ctx.match[1]);
    const session = (ctx as any).session;
    if (!session || !session.tempStores || !session.tempStores[index]) return ctx.reply("❌ Помилка сесії.");

    const selectedStore = session.tempStores[index];
    const telegramId = ctx.from.id.toString();
    const updatedStore = await prisma.store.update({ where: { telegramId }, data: { storeName: selectedStore.storeName, address: selectedStore.address } });
    await handleRepeatFromSheetMenu(ctx, updatedStore);
  });

  // --- ARŞİVDEKİ SİPARİŞİ ONAYLAMA VE GÖNDERME ---
  bot.action("ws_do_sheet_repeat", async (ctx) => {
    await ctx.answerCbQuery("Обробка...", { show_alert: false });
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });
    if (!store || !store.storeName) return ctx.reply("❌ Помилка.");

    const historyData = await getStoreHistoryFromSheets(store.storeName);
    if (!historyData) return ctx.reply("❌ Не вдалося завантажити архів.");

    const dates = Object.keys(historyData);
    const lastDate = dates[dates.length - 1];
    const lastOrderItems = historyData[lastDate];

    let cart: Record<number, number> = {};
    const allProducts = await prisma.product.findMany(); 

    for (const item of lastOrderItems) {
      const product = allProducts.find(p => p.name.trim().toLowerCase() === item.product.trim().toLowerCase());
      if (product) {
        cart[product.id] = parseInt(item.qty);
      }
    }

    if (Object.keys(cart).length === 0) {
      return ctx.reply("❌ Жоден товар з минулого замовлення не знайдено в поточному меню. Можливо, назви змінилися.", { ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]]) });
    }

    wholesaleCarts.set(telegramId, cart);
    await processWholesaleOrder(ctx, telegramId, store, bot);
  });

  bot.action(/ws_cat_(\d+)/, async (ctx) => { 
    await ctx.answerCbQuery(); 
    await renderWholesaleCart(ctx, ctx.from.id.toString(), parseInt(ctx.match[1]), 0); 
  });

  bot.action(/ws_page_(\d+)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    await renderWholesaleCart(ctx, ctx.from.id.toString(), parseInt(ctx.match[1]), parseInt(ctx.match[2]));
  });

  bot.action(/ws_set_(\d+)_(\d+)_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    (ctx as any).session = { waitingForQty: true, editCategoryId: ctx.match[1], editProductId: ctx.match[2], editPage: ctx.match[3] };
    await sendToBottom(ctx, "🔢 Введіть кількість :", Markup.forceReply().placeholder("Наприклад: 25"));
  });

  bot.action("ws_submit", async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });
    if (!store) return ctx.reply("❌ Помилка.");
    await processWholesaleOrder(ctx, telegramId, store, bot);
  });

  bot.action("wholesale_prices", async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    await ctx.deleteMessage().catch(() => {});
    const photoUrls = [
      "https://i.postimg.cc/BnHDZbbP/1.png",
      "https://i.postimg.cc/43GcYGHm/2.png",
      "https://i.postimg.cc/8CGv7Gff/3.png",
      "https://i.postimg.cc/HLmMrm8r/4.png",
      "https://i.postimg.cc/43GcYGHK/5.png",
      "https://i.postimg.cc/5tJzXJQF/6.png",
      "https://i.postimg.cc/ZqmNWmvd/7.png"
    ];

    const mediaGroup = photoUrls.map((url, index) => {
      if (index === 0) {
        return { 
          type: 'photo', 
          media: url, 
          caption: "📋 <b>Оптовий прайс-лист</b>\n", 
          parse_mode: "HTML" 
        };
      }
      return { type: 'photo', media: url };
    });

    try {
      await ctx.replyWithMediaGroup(mediaGroup as any);
      await ctx.reply("Оберіть дію:", Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]
      ]));

    } catch (error) {
      console.error("TELEGRAM API HATASI (Оптовий прайс):", error);
      await ctx.reply("❌ Не вдалося завантажити прайс-лист. Будь ласка, спробуйте пізніше.", Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]
      ]));
    }
  });

  bot.action(/wp_cat_(\d+)/, async (ctx) => {
    await ctx.answerCbQuery();
    await renderCategoryPrices(ctx, parseInt(ctx.match[1]));
  });

  bot.action(/ws_hist_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.from.id.toString();
    const store = await prisma.store.findUnique({ where: { telegramId } });
    if (store && store.storeName) await handleWholesaleHistoryDetail(ctx, ctx.match[1], telegramId, store, bot);
  });

  bot.action("wholesale_support", async (ctx) => {
    await ctx.answerCbQuery();
    (ctx as any).session = { waitingForSupport: true };
    await sendToBottom(ctx, "💬 Напишіть ваше запитання до оператора:", Markup.forceReply());
  });
}