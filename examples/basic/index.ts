import { Telepush } from "telepush";

const client = new Telepush({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!
});

await client.push("Example: hello from telepush");
