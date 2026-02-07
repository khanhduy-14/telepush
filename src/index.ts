export type TelepushConfig = {
  botToken: string;
  chatId: string | number;
  apiBaseUrl?: string;
  defaultTimeoutMs?: number;
};

export type PushOptions = {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  disableNotification?: boolean;
  protectContent?: boolean;
  replyToMessageId?: number;
  messageThreadId?: number;
  disableWebPagePreview?: boolean;
  timeoutMs?: number;
};

export type TelegramResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

export type SendMessageResult = {
  message_id: number;
  date: number;
  text?: string;
};

export class TelepushError extends Error {
  readonly status?: number;
  readonly code?: number;

  constructor(message: string, status?: number, code?: number) {
    super(message);
    this.name = "TelepushError";
    this.status = status;
    this.code = code;
  }
}

export class Telepush {
  private readonly botToken: string;
  private readonly chatId: string | number;
  private readonly apiBaseUrl: string;
  private readonly defaultTimeoutMs?: number;

  constructor(config: TelepushConfig) {
    if (!config?.botToken) {
      throw new TelepushError("botToken is required");
    }
    if (config?.chatId === undefined || config?.chatId === null || config?.chatId === "") {
      throw new TelepushError("chatId is required");
    }

    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api.telegram.org").replace(/\/$/, "");
    this.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  async push(text: string, options: PushOptions = {}): Promise<SendMessageResult> {
    if (!text || text.trim().length === 0) {
      throw new TelepushError("text must be a non-empty string");
    }

    const payload: Record<string, unknown> = {
      chat_id: this.chatId,
      text
    };

    if (options.parseMode) payload.parse_mode = options.parseMode;
    if (options.disableNotification !== undefined) payload.disable_notification = options.disableNotification;
    if (options.protectContent !== undefined) payload.protect_content = options.protectContent;
    if (options.replyToMessageId !== undefined) payload.reply_to_message_id = options.replyToMessageId;
    if (options.messageThreadId !== undefined) payload.message_thread_id = options.messageThreadId;
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
          "content-type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = (await response.json()) as TelegramResponse<SendMessageResult>;

      if (!response.ok) {
        throw new TelepushError(data.description ?? `HTTP ${response.status}`, response.status, data.error_code);
      }

      if (!data.ok) {
        throw new TelepushError(data.description ?? "Telegram API error", response.status, data.error_code);
      }

      if (!data.result) {
        throw new TelepushError("Telegram API returned no result", response.status, data.error_code);
      }

      return data.result;
    } catch (err) {
      if (err instanceof TelepushError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TelepushError("Request timed out");
      }
      throw new TelepushError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

export const createTelepush = (config: TelepushConfig) => new Telepush(config);
