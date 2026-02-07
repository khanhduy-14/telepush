# telepush

Send Telegram messages to your personal account with a small Node.js/TypeScript library.

## Install

```bash
npm install telepush
```

## Quick Start (TypeScript)

```ts
import { Telepush } from "telepush";

const client = new Telepush({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!
});

await client.push("Hello from telepush!");
```

## Quick Start (JavaScript)

```js
import { Telepush } from "telepush";

const client = new Telepush({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID
});

client.push("Hello from telepush!")
  .then(() => console.log("sent"))
  .catch(console.error);
```

## CLI

```bash
telepush send "Hello from CLI" \
  --token "$TELEGRAM_BOT_TOKEN" \
  --chat-id "$TELEGRAM_CHAT_ID"
```

## Config

```ts
type TelepushConfig = {
  botToken: string;              // Telegram bot token
  chatId: string | number;       // Your personal chat id
  apiBaseUrl?: string;           // Default: https://api.telegram.org
  defaultTimeoutMs?: number;     // Optional request timeout
};
```

## Push Options

```ts
type PushOptions = {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  messageThreadId?: number;
  disableWebPagePreview?: boolean;
  timeoutMs?: number;
};
```

## How To Get `botToken` and `chatId`

1. Create a Telegram bot via BotFather and copy the token.
2. Start a chat with your bot and send a message.
3. Get your chat id using the Telegram API:

```bash
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
```

Look for `chat.id` in the response.

## Example Project

See `examples/basic` for a minimal usage sample.

## Tests

```bash
npm test
```

## License

MIT
