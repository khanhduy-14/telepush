import { Telepush } from "./index.js";

const args = process.argv.slice(2);

const printHelp = () => {
  console.log(`Usage:
  telepush send "message" [options]
  telepush doctor

Options:
  --token <token>        Telegram bot token (or TELEGRAM_BOT_TOKEN)
  --chat-id <id>         Telegram chat id (or TELEGRAM_CHAT_ID)
  --parse-mode <mode>    Markdown | MarkdownV2 | HTML
  --silent               Disable notification
  --timeout <ms>         Request timeout in ms
  --help                 Show help
`);
};

const getArgValue = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
};

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const command = args[0];

if (command !== "send" && command !== "doctor") {
  console.error("Unknown command.");
  printHelp();
  process.exit(1);
}

const message = command === "send" ? args[1] : undefined;
if (command === "send" && !message) {
  console.error("Message is required.");
  printHelp();
  process.exit(1);
}


if (command === "doctor") {
  const token = getArgValue("--token") ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getArgValue("--chat-id") ?? process.env.TELEGRAM_CHAT_ID;

  let hasErrors = false;
  if (!token) {
    console.error("❌ Missing token. Set TELEGRAM_BOT_TOKEN or use --token.");
    hasErrors = true;
  } else {
    console.log("✅ Token is present (hidden).");
  }

  if (!chatId) {
    console.error("❌ Missing chat id. Set TELEGRAM_CHAT_ID or use --chat-id.");
    hasErrors = true;
  } else {
    console.log(`✅ Chat ID is configured: ${chatId}`);
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log("✅ Configuration is valid.");
    process.exit(0);
  }
}

const token = getArgValue("--token") ?? process.env.TELEGRAM_BOT_TOKEN;
const chatId = getArgValue("--chat-id") ?? process.env.TELEGRAM_CHAT_ID;
const parseMode = getArgValue("--parse-mode") as
  | "Markdown"
  | "MarkdownV2"
  | "HTML"
  | undefined;
const silent = args.includes("--silent");
const timeoutRaw = getArgValue("--timeout");
const timeoutMs = timeoutRaw ? Number(timeoutRaw) : undefined;

if (!token || !chatId) {
  console.error("Missing token or chat id.");
  printHelp();
  process.exit(1);
}

const client = new Telepush({
  botToken: token,
  chatId: chatId
});

client
  .push(message as string, {
    parseMode,
    disableNotification: silent || undefined,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined
  })
  .then(() => {
    console.log("sent");
  })
  .catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
