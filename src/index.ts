/**
 * Configuration for the Telepush client.
 */
export type TelepushConfig = {
  /**
   * Telegram bot token from BotFather.
   * Example: "123456:ABCDEF..."
   */
  botToken: string;
  /**
   * Your personal chat id (string or number).
   * You can fetch it via: https://api.telegram.org/bot<TOKEN>/getUpdates
   */
  chatId: string | number;
  /**
   * Optional custom Telegram API base URL.
   * Default: "https://api.telegram.org"
   */
  apiBaseUrl?: string;
  /**
   * Optional default request timeout in milliseconds.
   * Used when `push()` does not pass a `timeoutMs`.
   */
  defaultTimeoutMs?: number;
};

/**
 * Options for sending a message.
 */
export type PushOptions = {
  /**
   * Parse mode to format the message.
   * "Markdown" | "MarkdownV2" | "HTML"
   */
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  /** Disable notification (silent message). */
  disableNotification?: boolean;
  /** Prevent forwarding or saving the message content. */
  protectContent?: boolean;
  /** Reply to a specific message id. */
  replyToMessageId?: number;
  /** Target a topic/thread within a forum chat. */
  messageThreadId?: number;
  /** Disable link previews for URLs in the message. */
  disableWebPagePreview?: boolean;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
};

/**
 * Minimal Telegram API response shape.
 */
export type TelegramResponse<T> = {
  /** True when the API call succeeded. */
  ok: boolean;
  /** Result payload returned by Telegram. */
  result?: T;
  /** Error description when `ok` is false. */
  description?: string;
  /** Telegram-specific error code, if provided. */
  error_code?: number;
};

/**
 * Minimal sendMessage result shape returned by Telegram.
 */
export type SendMessageResult = {
  /** Unique message id in the chat. */
  message_id: number;
  /** Unix timestamp (seconds) of the message. */
  date: number;
  /** Message text, if any. */
  text?: string;
};

/**
 * Error thrown by Telepush when a request fails.
 */
export class TelepushError extends Error {
  /** HTTP status code, if available. */
  readonly status?: number;
  /** Telegram error code, if available. */
  readonly code?: number;

  constructor(message: string, status?: number, code?: number) {
    super(message);
    this.name = "TelepushError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Telepush client to send messages to a personal Telegram account.
 */
export class Telepush {
  private readonly botToken: string;
  private readonly chatId: string | number;
  private readonly apiBaseUrl: string;
  private readonly defaultTimeoutMs?: number;

  /**
   * Create a new Telepush client.
   * @param config - Telepush configuration.
   */
  constructor(config: TelepushConfig) {
    if (!config?.botToken) {
      throw new TelepushError("botToken is required");
    }
    if (
      config?.chatId === undefined ||
      config?.chatId === null ||
      config?.chatId === ""
    ) {
      throw new TelepushError("chatId is required");
    }

    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.telegram.org").replace(
      /\/$/,
      "",
    );
    this.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  /**
   * Send a message to the configured chat.
   * @param text - Message content (required).
   * @param options - Optional send options.
   * @returns Telegram sendMessage result (message id, date, text).
   * @throws TelepushError on validation, network, or API failure.
   */
  async push(
    text: string,
    options: PushOptions = {},
  ): Promise<SendMessageResult> {
    if (!text || text.trim().length === 0) {
      throw new TelepushError("text must be a non-empty string");
    }

    const payload: Record<string, unknown> = {
      chat_id: this.chatId,
      text,
    };

    if (options.parseMode) payload.parse_mode = options.parseMode;
    if (options.disableNotification !== undefined)
      payload.disable_notification = options.disableNotification;
    if (options.protectContent !== undefined)
      payload.protect_content = options.protectContent;
    if (options.replyToMessageId !== undefined)
      payload.reply_to_message_id = options.replyToMessageId;
    if (options.messageThreadId !== undefined)
      payload.message_thread_id = options.messageThreadId;
    if (options.disableWebPagePreview !== undefined) {
      payload.disable_web_page_preview = options.disableWebPagePreview;
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    let timeout: NodeJS.Timeout | undefined;

    if (timeoutMs && timeoutMs > 0) {
      timeout = setTimeout(() => controller.abort(), timeoutMs);
    }

    const url = `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const data =
        (await response.json()) as TelegramResponse<SendMessageResult>;

      if (!response.ok) {
        throw new TelepushError(
          data.description ?? `HTTP ${response.status}`,
          response.status,
          data.error_code,
        );
      }

      if (!data.ok) {
        throw new TelepushError(
          data.description ?? "Telegram API error",
          response.status,
          data.error_code,
        );
      }

      if (!data.result) {
        throw new TelepushError(
          "Telegram API returned no result",
          response.status,
          data.error_code,
        );
      }

      return data.result;
    } catch (err) {
      if (err instanceof TelepushError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TelepushError("Request timed out");
      }
      throw new TelepushError(
        err instanceof Error ? err.message : "Unknown error",
      );
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

/**
 * Convenience factory for creating a Telepush client.
 */
export const createTelepush = (config: TelepushConfig) => new Telepush(config);
