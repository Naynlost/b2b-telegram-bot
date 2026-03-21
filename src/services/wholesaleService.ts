import { Telegraf, Markup } from 'telegraf';
import { prisma } from '../lib/prisma';
import { wholesaleCarts } from '../store/cartStore';
import { sendToBottom } from '../utils/helpers';
import { getStoreHistoryFromSheets } from '../googleSheets';

export async function processWholesaleOrder(ctx: any, telegramId: string, store: any, bot: Telegraf) {
  const cart = wholesaleCarts.get(telegramId);
  if (!cart || Object.keys(cart).length === 0) return ctx.reply("❌ Ваш кошик порожній.");

  const productIds = Object.keys(cart).map(Number);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

  let orderDetailsText = "";
  let totalAmount = 0;

  products.forEach((p: any) => {
    const qty = cart[p.id];
    const itemTotal = qty * p.price;
    totalAmount += itemTotal;
    orderDetailsText += `▪️ ${p.name} — ${qty} шт. (x ${p.price}₴ = ${itemTotal}₴)\n`;
  });

  try {
    // Siparişi Veritabanına Kaydet
    const newOrder = await prisma.order.create({
      data: {
        storeId: store.id,
        total: totalAmount,
        status: "ОЧІКУЄ",
        items: { create: products.map((p: any) => ({ productId: p.id, quantity: cart[p.id], price: p.price })) }
      }
    });

    // Müşteriye Başarı Mesajı Gönder
    await sendToBottom(ctx, `✅ <b>Ваше замовлення успішно відправлено!</b>\n\n📍 <b>Магазин:</b> ${store.storeName}\n🗺 <b>Адреса:</b> ${store.address}\n\n📄 <b>Деталі:</b>\n${orderDetailsText}\n💰 <b>Всього: ${totalAmount} ₴</b>`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Повернутися до меню", "back_to_wholesale_menu")]]) });

    const admins = await prisma.admin.findMany();
    const adminMessage = `📦 <b>НОВЕ ОПТОВЕ ЗАМОВЛЕННЯ!</b>\n\n👤 <b>TG Користувач:</b> ${store.name || ctx.from?.first_name}\n🏪 <b>Магазин:</b> ${store.storeName}\n🗺 <b>Адреса:</b> ${store.address}\n📱 <b>Телефон:</b> ${store.phone}\n🆔 ${telegramId}\n\n📝 <b>Замовлення (№${newOrder.id}):</b>\n${orderDetailsText}\n💰 <b>Загальна сума: ${totalAmount} ₴</b>`;

    for (const admin of admins) {
      await bot.telegram.sendMessage(admin.telegramId, adminMessage, { 
        parse_mode: "HTML" 
      }).catch(() => {});
    }

    // Sepeti Temizle
    wholesaleCarts.delete(telegramId);
  } catch (error) {
    console.error("Помилка створення замовлення:", error);
    await ctx.reply("❌ Виникла помилка при оформленні замовлення. ");
  }
}

export async function handleWholesaleBalance(ctx: any, telegramId: string, store: any, bot: Telegraf) {
  const historyData = await getStoreHistoryFromSheets(store.storeName);

  if (!historyData || Object.keys(historyData).length === 0) {
    return sendToBottom(ctx, `📭 У магазину <b>${store.storeName}</b> ще немає історії замовлень в архіві.`, {
      parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]])
    });
  }

  const dates = Object.keys(historyData);
  const recentDates = dates.slice(-10);
  const buttons = recentDates.map(date => [Markup.button.callback(`📅 ${date} - Переглянути деталі`, `ws_hist_${date}`)]);
  buttons.push([Markup.button.callback("🔙 Назад до меню", "back_to_wholesale_menu")]);

  await sendToBottom(ctx, `📊 <b>Історія замовлень: ${store.storeName}</b>\n\nОберіть дату для перегляду деталей:`, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });

  const admins = await prisma.admin.findMany();
  for (const admin of admins) {
    await bot.telegram.sendMessage(admin.telegramId, `👀 <b>Активність клієнта:</b>\n🏪 Магазин <b>${store.storeName}</b> щойно відкрив список своєї історії замовлень.`, { parse_mode: "HTML" }).catch(() => {});
  }
}

export async function handleWholesaleHistoryDetail(ctx: any, dateStr: string, telegramId: string, store: any, bot: Telegraf) {
  const historyData = await getStoreHistoryFromSheets(store.storeName);
  if (!historyData || !historyData[dateStr]) return ctx.reply("❌ Помилка завантаження даних.");

  const dayData = historyData[dateStr];
  let receiptText = `📅 <b>Дата:</b> ${dateStr}\n🏪 <b>Магазин:</b> ${store.storeName}\n\n📝 <b>Деталі замовлення:</b>\n`;
  let dailyTotal = 0;
  let paymentStatus = dayData[0].status;

  dayData.forEach((item: any) => {
    receiptText += `▪️ ${item.product} — ${item.qty} шт. (${item.totalAmount} ₴)\n`;
    dailyTotal += parseFloat(item.totalAmount.replace(',', '.')) || 0;
  });

  receiptText += `\n💰 <b>Загальна сума:</b> ${dailyTotal.toFixed(2)} ₴\n📊 <b>Статус:</b> ${paymentStatus}`;

  await sendToBottom(ctx, receiptText, {
    parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 До списку дат", "wholesale_balance")], [Markup.button.callback("🔙 Головне меню", "back_to_wholesale_menu")]])
  });

  const admins = await prisma.admin.findMany();
  for (const admin of admins) {
    await bot.telegram.sendMessage(admin.telegramId, `👀 <b>Активність клієнта (Деталі):</b>\n🏪 Магазин <b>${store.storeName}</b> зараз переглядає свій чек та статус боргу за <b>${dateStr}</b>.`, { parse_mode: "HTML" }).catch(() => {});
  }
}