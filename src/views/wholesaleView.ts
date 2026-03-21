import { Markup } from 'telegraf';
import { prisma } from '../lib/prisma';
import { wholesaleCarts } from '../store/cartStore';
import { sendToBottom } from '../utils/helpers';

export async function renderCategoriesMenu(ctx: any) {
  const categories = await prisma.category.findMany();
  if (categories.length === 0) return sendToBottom(ctx, "😔 Наразі немає категорій.", { parse_mode: "HTML" });

  const categoryEmojiMap: Record<string, string> = {
    "Хліба та Батони": "🍞", "Булочки та здоба": "🥐", "Лаваші": "🫓", "Святкові вироби": "🎂", "Кекси та кондитерські вироби": "🧁"
  };

  const buttons = categories.map((c: any) => {
    const emoji = categoryEmojiMap[c.name] || "📁";
    return [Markup.button.callback(`${emoji} ${c.name}`, `ws_cat_${c.id}`)];
  });

  buttons.push([Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]);
  await sendToBottom(ctx, "📝 <b>Оберіть категорію:</b>", { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

// Sayfa (page) parametresini varsayılan olarak 0 atadık
export async function renderWholesaleCart(ctx: any, telegramId: string, categoryId: number, page: number = 0) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { products: { where: { isAvailable: true } } } });
  if (!category || category.products.length === 0) return sendToBottom(ctx, `😔 У категорії "<b>${category?.name}</b>" немає доступних товарів.`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 До категорій", "wholesale_order")]]) });

  let cart = wholesaleCarts.get(telegramId) || {};
  wholesaleCarts.set(telegramId, cart);
  let totalAmount = 0;
  
  const cartProductIds = Object.keys(cart).map(Number);
  if (cartProductIds.length > 0) {
    const allCartProducts = await prisma.product.findMany({ where: { id: { in: cartProductIds } } });
    allCartProducts.forEach((p: any) => { totalAmount += (cart[p.id] || 0) * p.price; });
  }

  const ITEMS_PER_PAGE = 10; // Her sayfada kaç ürün gösterilecek
  const totalProducts = category.products.length;
  const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);
  const paginatedProducts = category.products.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const buttons = [];
  paginatedProducts.forEach((p: any) => {
    const qty = cart[p.id] || 0;
    const itemTotal = qty * p.price;
    buttons.push([Markup.button.callback(`✍️ ${p.name} (${p.price}₴) — Кількість: ${qty} шт.`, `ws_set_${categoryId}_${p.id}_${page}`)]);
    if (qty > 0) buttons.push([Markup.button.callback(`   ↳ Всього: ${itemTotal}₴`, "ignore_click")]);
  });

  // Önceki ve Sonraki Butonlarını Çiz
  const navButtons = [];
  if (page > 0) navButtons.push(Markup.button.callback("⬅️ Попередня ", `ws_page_${categoryId}_${page - 1}`));
  if (page < totalPages - 1) navButtons.push(Markup.button.callback("Наступна  ➡️", `ws_page_${categoryId}_${page + 1}`));
  if (navButtons.length > 0) buttons.push(navButtons);

  buttons.push([Markup.button.callback(`✅ Відправити замовлення (Разом: ${totalAmount}₴)`, "ws_submit")]);
  buttons.push([Markup.button.callback("🔙 Назад до категорій", "wholesale_order")]);
  
  // Üst bilgiye sayfa numarasını ekle
  const pageInfo = totalPages > 1 ? `\n📄 <i>Сторінка ${page + 1} з ${totalPages}</i>` : "";
  await sendToBottom(ctx, `📁 <b>Категорія: ${category.name}</b>${pageInfo}\n📝 Оберіть товари:`, { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

export async function renderWholesalePrices(ctx: any) {
  const categories = await prisma.category.findMany();
  if (categories.length === 0) return sendToBottom(ctx, "😔 Наразі категорій немає.", { ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад", "back_to_wholesale_menu")]]) });

  const categoryEmojiMap: Record<string, string> = {
    "Хліба та Батони": "🍞", "Булочки та здоба": "🥐", "Лаваші": "🫓", "Святкові вироби": "🎂", "Кекси та кондитерські вироби": "🧁"
  };

  const buttons = categories.map((c: any) => {
    const emoji = categoryEmojiMap[c.name] || "📁";
    return [Markup.button.callback(`${emoji} ${c.name}`, `wp_cat_${c.id}`)];
  });
  
  buttons.push([Markup.button.callback("🔙 Назад до меню", "back_to_wholesale_menu")]);
  await sendToBottom(ctx, "📋 <b>Оберіть категорію для перегляду цін:</b>", { parse_mode: "HTML", ...Markup.inlineKeyboard(buttons) });
}

export async function renderCategoryPrices(ctx: any, categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { products: { where: { isAvailable: true } } } });
  if (!category || category.products.length === 0) return sendToBottom(ctx, `😔 У категорії "<b>${category?.name}</b>" немає товарів.`, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 До категорій", "wholesale_prices")]]) });
  
  let priceText = `📋 <b>Прайс-лист: ${category.name}</b>\n\n`;
  category.products.forEach((p: any) => { priceText += `▪️ ${p.name} — ${p.price} ₴\n`; });
  await sendToBottom(ctx, priceText, { parse_mode: "HTML", ...Markup.inlineKeyboard([[Markup.button.callback("🔙 До категорій", "wholesale_prices")]]) });
}