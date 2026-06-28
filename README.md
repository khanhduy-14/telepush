# telepush

Lightweight Telegram notifications for Node.js apps, cron jobs, CI/CD, and monitoring.

## Installation

```bash
npm install telepush
```

## Quick Start (TypeScript / JavaScript)

```ts
import { Telepush } from "telepush";

const client = new Telepush({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
});

// Basic push
await client.push("Hello from telepush!");

// Advanced push with options
await client.push({
  text: "Deployment completed",
  parseMode: "Markdown",
  disableNotification: true,
});
```

## Semantic Helpers

Built-in helpers automatically prepend an emoji to your message.

```ts
await client.success("Deployment completed"); // ✅ Deployment completed
await client.error("Production deploy failed"); // ❌ Production deploy failed
await client.warning("Memory usage is high"); // ⚠️ Memory usage is high
await client.info("New user registered"); // ℹ️ New user registered
```

## Override target chat with `.to()`

Easily send a message to a different chat without mutating your base configuration.

```ts
const prodAlerts = client.to("-100123456789");
await prodAlerts.error({
  text: "*Production deploy failed*",
  parseMode: "Markdown",
});
```

## Configuration & Retries

You can set default timeouts and retry logic.

```ts
const client = new Telepush({
  botToken: process.env.TELEGRAM_BOT_TOKEN!,
  chatId: process.env.TELEGRAM_CHAT_ID!,
  defaultTimeoutMs: 10_000,
  retry: {
    retries: 3,
    minDelayMs: 500,
    maxDelayMs: 5_000,
    factor: 2,
  },
});
```

## Error Handling

Errors thrown by `Telepush` include useful properties.

```ts
import { TelepushError } from "telepush";

try {
  const message = await client.push("Hello");
  console.log(message.messageId);
} catch (error) {
  if (error instanceof TelepushError) {
    console.error(error.description);
    console.error(error.statusCode);
  }
}
```

## CLI

`telepush` includes a handy CLI.

```bash
telepush send "Hello from CLI" \
  --token "$TELEGRAM_BOT_TOKEN" \
  --chat-id "$TELEGRAM_CHAT_ID" \
  --parse-mode Markdown \
  --silent \
  --timeout 5000

# Validate configuration without sending a message
telepush doctor
```

## Getting a Telegram Bot Token and Chat ID

1. Talk to [BotFather](https://t.me/botfather) to create a new bot and get the `botToken`.
2. Talk to [userinfobot](https://t.me/userinfobot) or similar to find your personal `chatId`.

## Non-Goals

telepush is strictly focused on sending notifications. We have explicitly decided **not** to support:
- Webhooks
- Polling
- Building full Telegram bots (command handlers, plugins)

## API Reference

### `TelepushConfig`
- `botToken: string`
- `chatId: string | number`
- `apiBaseUrl?: string`
- `defaultTimeoutMs?: number`
- `retry?: TelepushRetryConfig`

### `TelepushRetryConfig`
- `retries?: number`
- `minDelayMs?: number`
- `maxDelayMs?: number`
- `factor?: number`

### `TelepushMessageOptions`
- `text: string`
- `chatId?: string | number`
- `parseMode?: "Markdown" | "MarkdownV2" | "HTML"`
- `disableNotification?: boolean`
- `protectContent?: boolean`
- `replyToMessageId?: number`
- `messageThreadId?: number`
- `disableWebPagePreview?: boolean`
- `timeoutMs?: number`

### `TelepushMessage`
- `messageId: number`
- `chatId: string | number`
- `date: number`
- `text?: string`
- `raw: unknown`

### Error Classes
- `TelepushConfigError`: Thrown when constructor configuration is invalid.
- `TelepushError`: Thrown on API errors, timeouts, or network failures. Includes `statusCode`, `telegramErrorCode`, `description`, `retryAfterSeconds`, and `cause`.
