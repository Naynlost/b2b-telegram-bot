import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import { prisma } from './lib/prisma';
import { testSheetConnection } from './googleSheets';
import { setupAdminHandlers } from './handlers/admin';
import { setupMainHandlers } from './handlers/main';
import { setupRetailHandlers } from './handlers/retail';
import { setupWholesaleHandlers } from './handlers/wholesale';
import { setupMessageHandlers } from './handlers/messages';

const bot = new Telegraf(process.env.BOT_TOKEN as string);
bot.use(session());

setupMainHandlers(bot);
setupRetailHandlers(bot);
setupWholesaleHandlers(bot);
setupMessageHandlers(bot);
setupAdminHandlers(bot);

bot.launch().then(async () => {
  console.log('✅ Bot başarıyla başlatıldı і dinlemede...');
  await testSheetConnection();
}).catch((err) => {
  console.error('❌ Bot başlatılırken hata oluştu:', err);
});

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  prisma.$disconnect();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  prisma.$disconnect();
});