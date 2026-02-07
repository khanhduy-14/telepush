import { Telepush } from "./index.js";

const args = process.argv.slice(2);

const printHelp = () => {
  // Keep output minimal for CLI usage
  console.log(`telepush send "message" [options]

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

if (command !== "send") {
  console.error("Unknown command.");
  printHelp();
  process.exit(1);
}

const message = args[1];
if (!message) {
  console.error("Message is required.");
  printHelp();
  process.exit(1);
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
  .push(message, {
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
