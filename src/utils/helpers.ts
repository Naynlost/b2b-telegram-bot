export async function sendToBottom(ctx: any, text: string, extra?: any) {
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage().catch(() => {});
  }
  return ctx.reply(text, extra);
}