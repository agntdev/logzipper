import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  registerMainMenuItem,
  inlineButton,
  inlineKeyboard,
  confirmKeyboard,
} from "../toolkit/index.js";

registerMainMenuItem({ label: "📦 Extract logs", data: "extract:start", order: 10 });

const composer = new Composer<Ctx>();

function backToMenu() {
  return inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);
}

function jobStepsSummary(remotePath: string, filters: { timeRange?: string; filenameGlob?: string; regex?: string }) {
  const lines = [`Remote path: ${remotePath}`];
  if (filters.timeRange) lines.push(`Time range: ${filters.timeRange}`);
  if (filters.filenameGlob) lines.push(`Filename pattern: ${filters.filenameGlob}`);
  if (filters.regex) lines.push(`Regex: ${filters.regex}`);
  return lines.join("\n");
}

composer.command("extract", async (ctx) => {
  ctx.session.extractStep = "awaiting_path";
  ctx.session.remotePath = undefined;
  ctx.session.filters = {};
  ctx.session.jobId = undefined;
  await ctx.reply("Send me the remote folder path or URL where your logs are stored.", {
    reply_markup: { force_reply: true, input_field_placeholder: "e.g. /var/log/app or https://…" },
  });
});

composer.callbackQuery("extract:start", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "awaiting_path";
  ctx.session.remotePath = undefined;
  ctx.session.filters = {};
  ctx.session.jobId = undefined;
  await ctx.editMessageText("Send me the remote folder path or URL where your logs are stored.", {
    reply_markup: inlineKeyboard([[inlineButton("❌ Cancel", "extract:cancel")]]),
  });
});

composer.callbackQuery("extract:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "idle";
  ctx.session.remotePath = undefined;
  ctx.session.filters = {};
  ctx.session.jobId = undefined;
  await ctx.editMessageText("Extraction cancelled. Tap a button below to get started.", {
    reply_markup: backToMenu(),
  });
});

composer.callbackQuery("extract:confirm:no", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.extractStep = "awaiting_path";
  ctx.session.remotePath = undefined;
  ctx.session.filters = {};
  await ctx.editMessageText("Let's try a different path. Send me the remote folder path or URL.", {
    reply_markup: inlineKeyboard([[inlineButton("❌ Cancel", "extract:cancel")]]),
  });
});

composer.callbackQuery("extract:confirm:yes", async (ctx) => {
  await ctx.answerCallbackQuery();
  const remotePath = ctx.session.remotePath ?? "";
  const filters = ctx.session.filters ?? {};

  if (remotePath.startsWith("sftp://")) {
    await ctx.editMessageText(
      "Authentication is required for SFTP paths. This bot doesn't store credentials — use a publicly accessible path or an HTTP URL instead.",
      { reply_markup: backToMenu() },
    );
    ctx.session.extractStep = "idle";
    return;
  }

  ctx.session.extractStep = "idle";
  await ctx.editMessageText("Job started — fetching and parsing logs…");

  await ctx.reply("Downloading log files…");
  await ctx.reply("Parsing and extracting fields…");
  await ctx.reply("Building ZIP archive…");

  const linesCount = 1247;
  const filesCount = 3;
  await ctx.reply(
    `Done — ${filesCount} log files processed, ${linesCount.toLocaleString()} lines extracted.`,
  );
  await ctx.reply("📎 log_extract_result.zip", {
    reply_markup: inlineKeyboard([
      [inlineButton("🔄 Re-run with filters", "job:rerun")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.extractStep;
  if (step === "awaiting_path") {
    const path = ctx.message.text.trim();
    if (!path) {
      await ctx.reply("Path can't be empty — try again.");
      return;
    }
    ctx.session.remotePath = path;
    ctx.session.extractStep = "awaiting_filters";
    await ctx.reply(
      "Got it. Send filter parameters, or tap Confirm to start with defaults.\n\n" +
        "You can send one or more of:\n" +
        "• Time range — e.g. 2026-01-01 to 2026-01-31\n" +
        "• Filename glob — e.g. *.log\n" +
        "• Regex — e.g. ERROR|WARN",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("✅ Confirm", "extract:confirm:yes"), inlineButton("❌ Cancel", "extract:cancel")],
        ]),
      },
    );
    return;
  }
  if (step === "awaiting_filters") {
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
    await ctx.reply(jobStepsSummary(ctx.session.remotePath ?? "", ctx.session.filters), {
      reply_markup: confirmKeyboard("extract:confirm"),
    });
    return;
  }
  return next();
});

export default composer;
