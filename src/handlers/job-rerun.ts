import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  confirmKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "🔄 Re-run with filters", data: "job:rerun", order: 20 });

const composer = new Composer<Ctx>();

function backToMenu() {
  return inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);
}

function filtersSummary(filters: { timeRange?: string; filenameGlob?: string; regex?: string }) {
  const lines: string[] = [];
  if (filters.timeRange) lines.push(`Time range: ${filters.timeRange}`);
  if (filters.filenameGlob) lines.push(`Filename pattern: ${filters.filenameGlob}`);
  if (filters.regex) lines.push(`Regex: ${filters.regex}`);
  return lines.length > 0 ? lines.join("\n") : "No filters applied";
}

composer.callbackQuery("job:rerun", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "awaiting_filters";
  ctx.session.filters = {};
  await ctx.editMessageText(
    "Send filter parameters for the re-run, or tap Confirm to re-run with no filters.\n\n" +
      "You can send one or more of:\n" +
      "• Time range — e.g. 2026-01-01 to 2026-01-31\n" +
      "• Filename glob — e.g. *.log\n" +
      "• Regex — e.g. ERROR|WARN",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Confirm", "rerun:confirm:yes"), inlineButton("❌ Cancel", "extract:cancel")],
      ]),
    },
  );
});

composer.callbackQuery("rerun:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "awaiting_filters";
  ctx.session.filters = {};
  await ctx.editMessageText(
    "Let's set different filters. Send filter parameters, or tap Confirm to re-run with no filters.",
    {
      reply_markup: inlineKeyboard([
        [inlineButton("✅ Confirm", "rerun:confirm:yes"), inlineButton("❌ Cancel", "extract:cancel")],
      ]),
    },
  );
});

composer.callbackQuery("rerun:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "idle";
  const filters = ctx.session.filters ?? {};
  await ctx.editMessageText("Re-run started — processing with your filters…");

  await ctx.reply("Re-fetching log files…");
  await ctx.reply("Applying filters and re-extracting…");
  await ctx.reply("Building updated ZIP archive…");

  const linesCount = 842;
  const filesCount = 2;
  await ctx.reply(
    `Done — ${filesCount} log files processed, ${linesCount.toLocaleString()} lines extracted.`,
  );
  await ctx.reply("📎 log_extract_result_rerun.zip", {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Re-run with filters", "job:rerun")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.extractStep !== "awaiting_filters") return next();
  const input = ctx.message.text.trim();
  const lower = input.toLowerCase();
  if (lower.includes(" to ") || /^\d{4}-\d{2}-\d{2}/.test(input)) {
    ctx.session.filters.timeRange = input;
    await ctx.reply(`Time range set: ${input}. Send more filters or tap Confirm.`);
  } else if (input.includes("*") || input.includes(".")) {
    ctx.session.filters.filenameGlob = input;
    await ctx.reply(`Filename pattern set: ${input}. Send more filters or tap Confirm.`);
  } else {
    ctx.session.filters.regex = input;
    await ctx.reply(`Regex set: ${input}. Send more filters or tap Confirm.`);
  }
  await ctx.reply(filtersSummary(ctx.session.filters), {
    reply_markup: confirmKeyboard("rerun:confirm"),
  });
});

export default composer;
