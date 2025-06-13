/**
 * 📧 Cloudflare Email-to-Telegram Worker
 *
 * A robust email forwarding service that intelligently processes incoming emails
 * and forwards them to Telegram with proper formatting and attachments.
 *
 * Features:
 * - Smart email parsing (multipart, base64, quoted-printable)
 * - Three-tier message delivery (metadata, body preview, full content)
 * - Comprehensive error handling and logging
 * - Rate limiting and spam protection
 * - Security validations
 *
 * @author WhoisGray
 * @version 2.0.0
 */

// Configuration constants
const CONFIG = {
  MAX_BODY_LENGTH: 4000,
  MAX_SUBJECT_LENGTH: 100,
  TELEGRAM_MESSAGE_LIMIT: 4096,
  ALLOWED_CONTENT_TYPES: ["text/plain", "text/html"],
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_EMAILS_PER_WINDOW: 10,
};

// Rate limiting storage (in production, consider using Durable Objects or KV)
const rateLimitStore = new Map();

/**
 * Enhanced stream reader with error handling
 * @param {ReadableStream} stream - The stream to read
 * @returns {Promise<string>} The stream content as string
 */
async function streamToString(stream) {
  if (!stream) {
    throw new Error("Stream is null or undefined");
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  } catch (error) {
    console.error("Error reading stream:", error);
    throw new Error("Failed to read email stream");
  } finally {
    reader.releaseLock();
  }
}

/**
 * Advanced email body extraction with support for multiple encodings
 * @param {string} rawEmail - Raw email content
 * @returns {Object} Extracted body information
 */
function extractEmailContent(rawEmail) {
  if (!rawEmail || typeof rawEmail !== "string") {
    return { body: "Invalid email content", contentType: "text/plain" };
  }

  // Find multipart boundary
  const boundaryMatch = rawEmail.match(/boundary=["']?([^"'\s]+)["']?/i);

  if (!boundaryMatch) {
    // Simple email without multipart
    return extractSimpleEmailBody(rawEmail);
  }

  const boundary = boundaryMatch[1];
  const parts = rawEmail.split(`--${boundary}`);

  // Priority: text/plain > text/html > any text content
  let bestPart = null;
  let bestScore = 0;

  for (const part of parts) {
    const score = getPartScore(part);
    if (score > bestScore) {
      bestPart = part;
      bestScore = score;
    }
  }

  return bestPart
    ? extractPartContent(bestPart)
    : { body: "No readable content found", contentType: "text/plain" };
}

/**
 * Extract content from simple (non-multipart) emails
 * @param {string} rawEmail - Raw email content
 * @returns {Object} Extracted content
 */
function extractSimpleEmailBody(rawEmail) {
  const headerEndIndex = rawEmail.indexOf("\r\n\r\n");
  if (headerEndIndex === -1) {
    return { body: "No body content found", contentType: "text/plain" };
  }

  const headers = rawEmail.substring(0, headerEndIndex);
  const body = rawEmail.substring(headerEndIndex + 4).trim();

  const encoding = headers
    .match(/Content-Transfer-Encoding:\s*(.+)/i)?.[1]
    ?.trim();
  const contentType =
    headers.match(/Content-Type:\s*([^;]+)/i)?.[1]?.trim() || "text/plain";

  return {
    body: decodeContent(body, encoding),
    contentType: contentType,
  };
}

/**
 * Score email parts for content extraction priority
 * @param {string} part - Email part content
 * @returns {number} Priority score
 */
function getPartScore(part) {
  if (part.includes("Content-Type: text/plain")) return 3;
  if (part.includes("Content-Type: text/html")) return 2;
  if (part.includes("Content-Type: text/")) return 1;
  return 0;
}

/**
 * Extract content from a specific email part
 * @param {string} part - Email part content
 * @returns {Object} Extracted content
 */
function extractPartContent(part) {
  const headerEndIndex = part.indexOf("\r\n\r\n");
  if (headerEndIndex === -1) {
    return { body: "Invalid part format", contentType: "text/plain" };
  }

  const headers = part.substring(0, headerEndIndex);
  const content = part.substring(headerEndIndex + 4).trim();

  const encoding = headers
    .match(/Content-Transfer-Encoding:\s*(.+)/i)?.[1]
    ?.trim();
  const contentType =
    headers.match(/Content-Type:\s*([^;]+)/i)?.[1]?.trim() || "text/plain";

  return {
    body: decodeContent(content, encoding),
    contentType: contentType,
  };
}

/**
 * Decode content based on transfer encoding
 * @param {string} content - Encoded content
 * @param {string} encoding - Transfer encoding type
 * @returns {string} Decoded content
 */
function decodeContent(content, encoding) {
  if (!content) return "";

  try {
    switch (encoding?.toLowerCase()) {
      case "base64":
        return decodeBase64Content(content);
      case "quoted-printable":
        return decodeQuotedPrintable(content);
      default:
        return content;
    }
  } catch (error) {
    console.error(`Failed to decode content with encoding ${encoding}:`, error);
    return content; // Fallback to original content
  }
}

/**
 * Decode base64 content with proper UTF-8 handling and fallback
 * @param {string} content - Base64 encoded content
 * @returns {string} Decoded content
 */
function decodeBase64Content(content) {
  try {
    const cleanedContent = content.replace(/\s/g, "");
    const binaryString = atob(cleanedContent);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Try UTF-8 first, fallback to latin1 if it fails
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (utfError) {
      console.warn("UTF-8 decoding failed, trying latin1");
      return new TextDecoder("latin1").decode(bytes);
    }
  } catch (error) {
    console.error("Base64 decoding failed:", error);
    return content;
  }
}

/**
 * Decode quoted-printable content
 * @param {string} content - Quoted-printable encoded content
 * @returns {string} Decoded content
 */
function decodeQuotedPrintable(content) {
  return content
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=([A-F0-9]{2})/gi, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/**
 * Enhanced Markdown escaping for Telegram
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeMarkdownV2(text) {
  if (!text) return "";

  const specialChars = [
    "_",
    "*",
    "[",
    "]",
    "(",
    ")",
    "~",
    "`",
    ">",
    "#",
    "+",
    "-",
    "=",
    "|",
    "{",
    "}",
    ".",
    "!",
  ];
  let escapedText = String(text);

  specialChars.forEach((char) => {
    escapedText = escapedText.replaceAll(char, `\\${char}`);
  });

  return escapedText;
}

/**
 * Clean and fix encoding issues in text
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length
 * @returns {string} Cleaned text
 */
function cleanText(text, maxLength = CONFIG.MAX_BODY_LENGTH) {
  if (!text) return "";

  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Fix common encoding issues
    .replace(/â¯/g, " ") // Non-breaking space
    .replace(/Ã©/g, "é") // é
    .replace(/Ã /g, "à") // à
    .replace(/Ã¨/g, "è") // è
    .replace(/Ã¹/g, "ù") // ù
    .replace(/Ã§/g, "ç") // ç
    .replace(/Ã´/g, "ô") // ô
    .replace(/Ã®/g, "î") // î
    .replace(/Ã¢/g, "â") // â
    .replace(/Ã«/g, "ë") // ë
    .replace(/Ã¯/g, "ï") // ï
    .replace(/Ã¼/g, "ü") // ü
    .replace(/Ã¶/g, "ö") // ö
    .replace(/Ã¤/g, "ä") // ä
    .replace(/Ã/g, "À") // À
    .replace(/â/g, "'") // Smart quote
    .replace(/â/g, "'") // Smart quote
    .replace(/â/g, '"') // Smart quote
    .replace(/â/g, '"') // Smart quote
    .replace(/â/g, "—") // Em dash
    .replace(/â/g, "–") // En dash
    .trim();

  if (cleaned.length > maxLength) {
    cleaned =
      cleaned.substring(0, maxLength) +
      "...\n\n🔽 *Full content available in attached file*";
  }

  return cleaned;
}

/**
 * Rate limiting check
 * @param {string} identifier - Unique identifier (e.g., sender email)
 * @returns {boolean} Whether request is allowed
 */
function checkRateLimit(identifier) {
  const now = Date.now();
  const windowStart = now - CONFIG.RATE_LIMIT_WINDOW;

  // Clean old entries
  for (const [key, timestamps] of rateLimitStore.entries()) {
    const filtered = timestamps.filter((ts) => ts > windowStart);
    if (filtered.length === 0) {
      rateLimitStore.delete(key);
    } else {
      rateLimitStore.set(key, filtered);
    }
  }

  // Check current identifier
  const requests = rateLimitStore.get(identifier) || [];
  const recentRequests = requests.filter((ts) => ts > windowStart);

  if (recentRequests.length >= CONFIG.MAX_EMAILS_PER_WINDOW) {
    return false;
  }

  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
  return true;
}

/**
 * Validate environment configuration
 * @param {Object} env - Environment variables
 * @returns {Object} Validation result
 */
function validateConfig(env) {
  const errors = [];

  if (!env.TELEGRAM_BOT_TOKEN) {
    errors.push("TELEGRAM_BOT_TOKEN is required");
  } else if (!/^\d+:[A-Za-z0-9_-]+$/.test(env.TELEGRAM_BOT_TOKEN)) {
    errors.push("TELEGRAM_BOT_TOKEN format is invalid");
  }

  if (!env.TELEGRAM_CHANNEL_ID) {
    errors.push("TELEGRAM_CHANNEL_ID is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Send message to Telegram with enhanced error handling
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} Success status
 */
async function sendTelegramMessage(botToken, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const maxRetries = 3;

  // Validate inputs
  if (!text || text.trim().length === 0) {
    console.warn("Empty message text, skipping");
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
        ...options,
      };

      console.log(`Sending to Telegram (attempt ${attempt}):`, {
        chatId,
        textLength: text.length,
        parseMode: payload.parse_mode,
      });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log("Telegram message sent successfully");
        return true;
      }

      console.error(`Telegram API error (attempt ${attempt}):`, {
        status: response.status,
        error: responseData,
      });

      // Handle specific errors
      if (
        responseData.error_code === 400 &&
        responseData.description?.includes("parse_mode")
      ) {
        // Fallback to plain text if MarkdownV2 fails
        console.log("Retrying with plain text mode");
        const plainPayload = { ...payload, parse_mode: undefined };
        const plainResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plainPayload),
        });

        if (plainResponse.ok) {
          console.log(
            "Telegram message sent successfully (plain text fallback)"
          );
          return true;
        }
      }

      // Don't retry on certain errors
      if (responseData.error_code === 404 || responseData.error_code === 403) {
        throw new Error(
          `Telegram API error: ${responseData.description} (code: ${responseData.error_code})`
        );
      }

      if (attempt === maxRetries) {
        throw new Error(
          `Failed after ${maxRetries} attempts: ${responseData.description}`
        );
      }

      // Wait before retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    } catch (error) {
      console.error(`Network error (attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  return false;
}

/**
 * Send document to Telegram
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Chat ID
 * @param {Blob} file - File to send
 * @param {string} filename - File name
 * @param {string} caption - File caption
 * @returns {Promise<boolean>} Success status
 */
async function sendTelegramDocument(botToken, chatId, file, filename, caption) {
  const url = `https://api.telegram.org/bot${botToken}/sendDocument`;

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", file, filename);
  formData.append("caption", caption);

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Telegram API error: ${errorData.description}`);
    }

    return true;
  } catch (error) {
    console.error("Error sending document:", error);
    throw error;
  }
}

/**
 * Generate safe filename from message ID
 * @param {string} messageId - Email message ID
 * @returns {string} Safe filename
 */
function generateSafeFilename(messageId) {
  const cleanId = messageId.replace(/[<>:"'|?*\\/]/g, "").substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `email-${cleanId}-${timestamp}.txt`;
}

// Main worker export
export default {
  /**
   * Handle HTTP requests (health check endpoint)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "healthy",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
      });
    }

    return new Response(
      "📧 Email-to-Telegram Worker v2.0.0\n\n✅ Service is running\n🔧 Configure email routing to start forwarding emails",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  },

  /**
   * Main email processing handler
   */
  async email(message, env, ctx) {
    const startTime = Date.now();

    try {
      // Validate configuration
      const configValidation = validateConfig(env);
      if (!configValidation.isValid) {
        console.error("Configuration errors:", configValidation.errors);
        message.setReject("Service configuration error");
        return;
      }

      // Extract email metadata
      const from = message.headers.get("from") || "Unknown sender";
      const to = message.headers.get("to") || "Unknown recipient";
      const subject = message.headers.get("subject") || "No subject";
      const messageId =
        message.headers.get("message-id") || `no-id-${Date.now()}`;
      const date = message.headers.get("date") || new Date().toISOString();

      console.log(`Processing email: ${messageId} from ${from}`);

      // Rate limiting
      if (!checkRateLimit(from)) {
        console.warn(`Rate limit exceeded for ${from}`);
        message.setReject("Rate limit exceeded");
        return;
      }

      // Read and parse email content
      const rawEmail = await streamToString(message.raw);
      const { body: readableBody, contentType } = extractEmailContent(rawEmail);

      // Clean and prepare content
      const cleanedBody = cleanText(readableBody);
      const truncatedSubject =
        subject.length > CONFIG.MAX_SUBJECT_LENGTH
          ? subject.substring(0, CONFIG.MAX_SUBJECT_LENGTH) + "..."
          : subject;

      // 1. Send metadata message
      const metadataMessage = [
        "*📧 New Email Received*",
        "",
        `*From:* \`${escapeMarkdownV2(from)}\``,
        `*To:* \`${escapeMarkdownV2(to)}\``,
        `*Subject:* \`${escapeMarkdownV2(truncatedSubject)}\``,
        `*Date:* \`${escapeMarkdownV2(date)}\``,
        `*Content Type:* \`${escapeMarkdownV2(contentType)}\``,
        `*Message ID:* \`${escapeMarkdownV2(messageId)}\``,
      ].join("\n");

      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHANNEL_ID,
        metadataMessage
      );

      // 2. Send body preview if available
      if (cleanedBody && cleanedBody.trim() !== "No readable content found") {
        const bodyMessage = `*📄 Email Content:*\n\n${escapeMarkdownV2(
          cleanedBody
        )}`;
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_CHANNEL_ID,
          bodyMessage
        );
      }

      // 3. Send full email as attachment
      const filename = generateSafeFilename(messageId);
      const file = new Blob([rawEmail], { type: "text/plain; charset=utf-8" });
      const caption = `📎 Full email content: "${truncatedSubject}"`;

      await sendTelegramDocument(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHANNEL_ID,
        file,
        filename,
        caption
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `Email processed successfully in ${processingTime}ms: ${messageId}`
      );
    } catch (error) {
      console.error("Email processing failed:", error);
      message.setReject(`Processing failed: ${error.message}`);

      // Optional: Send error notification to Telegram
      try {
        const errorMessage = `*⚠️ Email Processing Error*\n\nFailed to process email\nError: \`${escapeMarkdownV2(
          error.message
        )}\``;
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          env.TELEGRAM_CHANNEL_ID,
          errorMessage
        );
      } catch (notificationError) {
        console.error("Failed to send error notification:", notificationError);
      }
    }
  },
};
