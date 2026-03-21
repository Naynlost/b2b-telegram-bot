import { Telegraf, Markup } from 'telegraf';
import { sendToBottom } from '../utils/helpers';

export function setupRetailHandlers(bot: Telegraf) {
  bot.action("flow_retail", async (ctx) => {
    await ctx.answerCbQuery();
    await sendToBottom(ctx, "🛒 <b>Роздрібний відділ</b>\n\nТут ви можете знайти наші магазини та зробити попереднє замовлення.", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📍 Де ми знаходимось?", "retail_location")],
        [Markup.button.callback("🍞 Асортимент та ціни", "retail_menu")],
        [Markup.button.callback("🛍 Зробити попереднє замовлення", "retail_preorder")],
        [Markup.button.callback("🗣 Залишити відгук", "retail_feedback")],
        [Markup.button.callback("🔙 Головне меню", "back_to_main")]
      ])
    });
  });

  bot.action("retail_location", async (ctx) => {
    await ctx.answerCbQuery();
    
    const linkDorojnik = "https://maps.app.goo.gl/rijcoyChTofMqqNy5";
    const linkRaduga = "https://maps.app.goo.gl/AkLcCcrFK5s2cKmp9";

    const locationText = `📍 <b>Наші адреси:</b>\n\n` +
      `🏢 <b>Хлібний магазин:</b> Арциз, Приринкова площа\n` +
      `⏰ 8:00 - 15:00\n\n` +
      `🏪 <b><a href="${linkDorojnik}">"Дорожник"</a>:</b> Арциз, Затишна 7а\n` +
      `⏰ 7:30 - 21:00\n\n` +
      `🏪 <b><a href="${linkRaduga}">"Радуга"</a>:</b> Арциз, 28 червня, 58а\n` +
      `⏰ 8:00 - 21:00\n\n` +
      `<i>Чекаємо на вас за свіжою випічкою!</i>`;

    await sendToBottom(ctx, locationText, {
      parse_mode: "HTML", 
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([[Markup.button.callback("🔙 Назад до меню", "flow_retail")]])
    });
  });

  // --- FİYAT LİSTESİ ---
  bot.action("retail_menu", async (ctx) => {
    await ctx.answerCbQuery();
    
    await ctx.deleteMessage().catch(() => {});

    const photoUrl = "https://i.imgur.com/SENIN_FOTOGRAFIN.jpg";

    await ctx.replyWithPhoto(
      { url: photoUrl },
      {
        caption: "🍞 <b>Наш асортимент та ціни</b>\n",
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Назад до меню", "flow_retail")]
        ])
      }
    );
  });

  bot.action("retail_preorder", async (ctx) => {
    await ctx.answerCbQuery();
    await sendToBottom(ctx, "🛍 <b>Оберіть магазин для самовивозу:</b>\n", {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("📍 Хлібний магазин (Приринкова площа)", "po_store_1")],
        [Markup.button.callback("📍 Дорожник (Затишна 7а)", "po_store_2")],
        [Markup.button.callback("📍 Радуга (28 червня, 58а)", "po_store_3")],
        [Markup.button.callback("🔙 Назад до меню", "flow_retail")]
      ])
    });
  });

  bot.action(/po_store_(\d)/, async (ctx) => {
    await ctx.answerCbQuery();
    const storeIndex = ctx.match[1];
    let storeName = storeIndex === "1" ? "Хлібний магазин, Арциз, Приринкова площа ⏰ 8:00-15:00" : storeIndex === "2" ? "\"Дорожник\", Арциз, Затишна 7а  ⏰ 7:30 - 21:00 " : "\"Радуга\", Арциз, 28 червня, 58а ⏰ 8:00 - 21:00";

    (ctx as any).session = { waitingForPreorder: true, preorderStore: storeName };
    await sendToBottom(ctx, `📍 <b>Магазин:</b> ${storeName}\n\n🛍 <b>Попереднє замовлення:</b>\nНапишіть, що саме ви хочете відкласти і о котрій годині заберете.\n\n<i>Приклад: Залиште 2 багети і 3 круасани, заберу о 18:30.</i>`, { parse_mode: "HTML", ...Markup.forceReply().placeholder("Ваше замовлення...") });
  });

  bot.action("retail_feedback", async (ctx) => {
    await ctx.answerCbQuery();
    (ctx as any).session = { waitingForFeedback: true };
    await sendToBottom(ctx, "📝 Напишіть ваш відгук або пропозицію одним повідомленням:\n", Markup.forceReply().placeholder("Ваш текст..."));
  });
}