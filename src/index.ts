/**
 * Configuration for the Telepush client.
 */
export type TelepushRetryConfig = {
  retries?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
};

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
  /**
   * Optional retry configuration.
   */
  retry?: TelepushRetryConfig;
};

export type TelepushParseMode = "Markdown" | "MarkdownV2" | "HTML";

/**
 * Options for sending a message.
 */
export type PushOptions = {
  /**
   * Parse mode to format the message.
   * "Markdown" | "MarkdownV2" | "HTML"
   */
  parseMode?: TelepushParseMode;
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

export interface TelepushMessageOptions extends PushOptions {
  text: string;
  chatId?: string | number;
}

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

export interface TelepushMessage {
  messageId: number;
  chatId: string | number;
  date: number;
  text?: string;
  raw: unknown;
}

/**
 * Error thrown by Telepush when a request fails.
 */
export class TelepushConfigError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "TelepushConfigError";
    this.code = code;
  }
}

export class TelepushError extends Error {
  readonly statusCode?: number;
  readonly telegramErrorCode?: number;
  readonly description?: string;
  readonly retryAfterSeconds?: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      telegramErrorCode?: number;
      description?: string;
      retryAfterSeconds?: number;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "TelepushError";
    this.statusCode = options?.statusCode;
    this.telegramErrorCode = options?.telegramErrorCode;
    this.description = options?.description;
    this.retryAfterSeconds = options?.retryAfterSeconds;
    this.cause = options?.cause;
  }
}


export interface InternalSendMessageRequest {
  url: string;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}

export interface InternalTelegramResponse {
  ok: boolean;
  status: number;
  result?: SendMessageResult;
  description?: string;
  error_code?: number;
  retry_after?: number;
}

export interface TelepushTransport {
  sendMessage(
    request: InternalSendMessageRequest,
    signal?: AbortSignal,
  ): Promise<InternalTelegramResponse>;
}

export class DefaultTransport implements TelepushTransport {
  async sendMessage(
    request: InternalSendMessageRequest,
    signal?: AbortSignal,
  ): Promise<InternalTelegramResponse> {
    let timeout: NodeJS.Timeout | undefined;
    let abortController = new AbortController();

    // Wire up external signal to internal controller
    const abortHandler = () => abortController.abort();
    if (signal) {
      signal.addEventListener("abort", abortHandler);
    }

    if (request.timeoutMs && request.timeoutMs > 0) {
      timeout = setTimeout(() => abortController.abort(), request.timeoutMs);
    }


    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request.payload),
        signal: abortController.signal,
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (err) {
        return {
          ok: false,
          status: response.status,
          description: responseText || `HTTP ${response.status}`,
        };
      }

      return {
        ok: response.ok && data.ok,
        status: response.status,
        result: data.result,
        description: data.description,
        error_code: data.error_code,
        retry_after: data.parameters?.retry_after,
      };
    } finally {

      if (timeout) clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener("abort", abortHandler);
      }
    }
  }
}


export const MathUtils = {
  random: () => Math.random(),
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const executeWithRetry = async <T>(
  operation: () => Promise<T>,
  isRetryable: (error: any) => boolean,
  getRetryAfterMs: (error: any) => number | undefined,
  config?: TelepushRetryConfig
): Promise<T> => {
  const retries = config?.retries ?? 0;
  const minDelayMs = config?.minDelayMs ?? 500;
  const maxDelayMs = config?.maxDelayMs ?? 5000;
  const factor = config?.factor ?? 2;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) {
        throw error;
      }

      attempt++;

      const retryAfterMs = getRetryAfterMs(error);
      let delayMs = retryAfterMs !== undefined
        ? retryAfterMs
        : Math.min(maxDelayMs, minDelayMs * Math.pow(factor, attempt - 1));

      if (retryAfterMs === undefined) {
        // Add small jitter (up to 10% of delay)
        const jitter = delayMs * 0.1 * MathUtils.random();
        delayMs += jitter;
      }

      await sleep(delayMs);
    }
  }
};

/**
 * Telepush client to send messages to a personal Telegram account.
 */

export class Telepush {
  private readonly botToken: string;
  private readonly chatId: string | number;
  private readonly apiBaseUrl: string;
  private readonly defaultTimeoutMs?: number;
  public readonly retry?: TelepushRetryConfig;
  private readonly transport: TelepushTransport;

  /**
   * Create a new Telepush client.
   * @param config - Telepush configuration.
   */
  constructor(config: TelepushConfig, transport?: TelepushTransport) {

    if (!config?.botToken) {
      throw new TelepushConfigError("botToken is required", "MISSING_BOT_TOKEN");
    }
    if (
      config?.chatId === undefined ||
      config?.chatId === null ||
      config?.chatId === ""
    ) {
      throw new TelepushConfigError("chatId is required", "MISSING_CHAT_ID");
    }

    if (config?.apiBaseUrl !== undefined && (!config.apiBaseUrl.startsWith("http://") && !config.apiBaseUrl.startsWith("https://"))) {
      throw new TelepushConfigError("apiBaseUrl must start with http:// or https://", "INVALID_API_BASE_URL");
    }

    if (config?.defaultTimeoutMs !== undefined && (typeof config.defaultTimeoutMs !== 'number' || config.defaultTimeoutMs <= 0)) {
      throw new TelepushConfigError("defaultTimeoutMs must be a positive number", "INVALID_TIMEOUT");
    }

    if (config?.retry) {
      if (config.retry.retries !== undefined && (typeof config.retry.retries !== 'number' || config.retry.retries < 0)) {
        throw new TelepushConfigError("retry.retries must be a non-negative number", "INVALID_RETRY_RETRIES");
      }
      if (config.retry.minDelayMs !== undefined && (typeof config.retry.minDelayMs !== 'number' || config.retry.minDelayMs <= 0)) {
        throw new TelepushConfigError("retry.minDelayMs must be a positive number", "INVALID_RETRY_MINDELAY");
      }
      if (config.retry.maxDelayMs !== undefined && (typeof config.retry.maxDelayMs !== 'number' || config.retry.maxDelayMs <= 0)) {
        throw new TelepushConfigError("retry.maxDelayMs must be a positive number", "INVALID_RETRY_MAXDELAY");
      }
      if (config.retry.factor !== undefined && (typeof config.retry.factor !== 'number' || config.retry.factor <= 0)) {
        throw new TelepushConfigError("retry.factor must be a positive number", "INVALID_RETRY_FACTOR");
      }
    }


    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.telegram.org").replace(
      /\/$/,
      "",
    );
    this.defaultTimeoutMs = config.defaultTimeoutMs;
    this.retry = config.retry;
    this.transport = transport ?? new DefaultTransport();
  }

  /**
   * Return a new Telepush instance scoped to a different chat id.
   */
  public to(chatId: string | number): Telepush {
    return new Telepush(
      {
        botToken: this.botToken,
        chatId,
        apiBaseUrl: this.apiBaseUrl,
        defaultTimeoutMs: this.defaultTimeoutMs,
        retry: this.retry,
      },
      this.transport
    );
  }

  /**
   * Send a message to the configured chat.
   */
  async push(
    textOrOptions: string | TelepushMessageOptions,
    options?: PushOptions,
  ): Promise<TelepushMessage> {
    let text: string;
    let pushOptions: TelepushMessageOptions;

    if (typeof textOrOptions === "string") {
      text = textOrOptions;
      pushOptions = { text, ...options };
    } else {
      text = textOrOptions.text;
      pushOptions = { ...textOrOptions, ...options };
    }

    if (!text || text.trim().length === 0) {
      throw new TelepushError("text must be a non-empty string");
    }

    const payload: Record<string, unknown> = {
      chat_id: pushOptions.chatId ?? this.chatId,
      text,
    };

    if (pushOptions.parseMode) payload.parse_mode = pushOptions.parseMode;
    if (pushOptions.disableNotification !== undefined)
      payload.disable_notification = pushOptions.disableNotification;
    if (pushOptions.protectContent !== undefined)
      payload.protect_content = pushOptions.protectContent;
    if (pushOptions.replyToMessageId !== undefined)
      payload.reply_to_message_id = pushOptions.replyToMessageId;
    if (pushOptions.messageThreadId !== undefined)
      payload.message_thread_id = pushOptions.messageThreadId;
    if (pushOptions.disableWebPagePreview !== undefined) {
      payload.disable_web_page_preview = pushOptions.disableWebPagePreview;
    }

    const timeoutMs = pushOptions.timeoutMs ?? this.defaultTimeoutMs;
    const url = `${this.apiBaseUrl}/bot${this.botToken}/sendMessage`;

    const request: InternalSendMessageRequest = {
      url,
      payload,
      timeoutMs,
    };

    const isRetryable = (error: any) => {
      if (error instanceof TelepushError) {
        if (error.statusCode === 429) return true;
        if (error.statusCode && error.statusCode >= 500) return true;
      }
      if (error instanceof Error && error.message.includes("timed out")) {
        return true;
      }
      if (error instanceof Error && error.message.includes("fetch failed")) {
        return true; // Network error
      }
      return false;
    };

    const getRetryAfterMs = (error: any) => {
      if (error instanceof TelepushError && error.retryAfterSeconds !== undefined) {
        return error.retryAfterSeconds * 1000;
      }
      return undefined;
    };

    const operation = async () => {
      try {
        const data = await this.transport.sendMessage(request);

        if (!data.ok) {
          throw new TelepushError(
            data.description ?? (data.status ? `HTTP ${data.status}` : "Telegram API error"),
            {
              statusCode: data.status,
              telegramErrorCode: data.error_code,
              retryAfterSeconds: data.retry_after
            }
          );
        }

        if (!data.result) {
          throw new TelepushError(
            "Telegram API returned no result",
            { statusCode: data.status, telegramErrorCode: data.error_code }
          );
        }

        return {
          messageId: data.result.message_id,
          chatId: payload.chat_id as string | number,
          date: data.result.date,
          text: data.result.text,
          raw: data.result,
        };
      } catch (err) {
        if (err instanceof TelepushError) throw err;
        if (err instanceof Error && err.name === "AbortError") {
          throw new TelepushError("Request timed out", { cause: err });
        }
        throw new TelepushError(
          err instanceof Error ? err.message : "Unknown error",
          { cause: err }
        );
      }
    };

    return executeWithRetry(operation, isRetryable, getRetryAfterMs, this.retry);
  }

  public async success(textOrOptions: string | Omit<TelepushMessageOptions, "text"> & { text: string }, options?: PushOptions): Promise<TelepushMessage> {
    return this.sendWithEmoji("✅", textOrOptions, options);
  }

  public async error(textOrOptions: string | Omit<TelepushMessageOptions, "text"> & { text: string }, options?: PushOptions): Promise<TelepushMessage> {
    return this.sendWithEmoji("❌", textOrOptions, options);
  }

  public async warning(textOrOptions: string | Omit<TelepushMessageOptions, "text"> & { text: string }, options?: PushOptions): Promise<TelepushMessage> {
    return this.sendWithEmoji("⚠️", textOrOptions, options);
  }

  public async info(textOrOptions: string | Omit<TelepushMessageOptions, "text"> & { text: string }, options?: PushOptions): Promise<TelepushMessage> {
    return this.sendWithEmoji("ℹ️", textOrOptions, options);
  }

  private async sendWithEmoji(
    emoji: string,
    textOrOptions: string | Omit<TelepushMessageOptions, "text"> & { text: string },
    options?: PushOptions
  ): Promise<TelepushMessage> {
    if (typeof textOrOptions === "string") {
      return this.push(`${emoji} ${textOrOptions}`, options);
    } else {
      return this.push({ ...textOrOptions, text: `${emoji} ${textOrOptions.text}` }, options);
    }
  }
}

/**
 * Convenience factory for creating a Telepush client.
 */
export const createTelepush = (config: TelepushConfig) => new Telepush(config);
