# 📧 CloudMail-to-Telegram

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WhoisGray/cloudmail-to-telegram)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)

> 🚀 **Professional email forwarding service** that intelligently processes incoming emails and forwards them to Telegram with proper formatting, smart parsing, and comprehensive error handling.

## ✨ Features

### 🎯 **Smart Email Processing**

- **Multi-format support**: Handles plain text, HTML, and multipart emails
- **Encoding detection**: Automatically decodes base64 and quoted-printable content
- **Content prioritization**: Intelligently selects the best readable content
- **Unicode support**: Proper UTF-8 handling for international emails

### 📱 **Telegram Integration**

- **Three-tier delivery**: Metadata → Body preview → Full attachment
- **Rich formatting**: Beautiful MarkdownV2 messages with emojis
- **File attachments**: Complete email content as downloadable .txt files
- **Error notifications**: Real-time alerts for processing failures

### 🛡️ **Enterprise-Grade Security**

- **Rate limiting**: Prevents spam and abuse (10 emails/minute per sender)
- **Input validation**: Comprehensive safety checks
- **Error handling**: Graceful failure recovery
- **Configuration validation**: Startup safety checks

### ⚡ **Performance & Reliability**

- **Retry logic**: Automatic retry with exponential backoff
- **Stream processing**: Memory-efficient email handling
- **Health monitoring**: Built-in health check endpoint
- **Detailed logging**: Comprehensive error tracking

## 🚀 Quick Setup

### 1. Prerequisites

- [Cloudflare account](https://cloudflare.com) with Workers plan
- [Telegram Bot Token](https://t.me/BotFather) from BotFather
- Telegram Channel ID where emails will be forwarded

### 2. Get Your Telegram Credentials

#### Create a Bot:

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the instructions
3. Save your bot token (format: `123456789:ABCdefGHIjklMN-OpqRSTuvwXYZ`)

#### Get Channel ID:

1. Add your bot to your channel as an administrator
2. Send a test message to your channel
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your channel ID in the response (format: `@yourchannel` or `-1001234567890`)

### 3. Deploy to Cloudflare Workers

#### Option A: One-Click Deploy

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/WhoisGray/cloudmail-to-telegram)

#### Option B: Manual Deploy

```bash
# Clone the repository
git clone https://github.com/WhoisGray/cloudmail-to-telegram.git
cd cloudmail-to-telegram

# Install Wrangler CLI (if not already installed)
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Configure your worker
cp wrangler.toml.example wrangler.toml
# Edit wrangler.toml with your account details

# Set environment variables
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHANNEL_ID

# Deploy
wrangler deploy
```

### 4. Configure Email Routing

1. Go to your Cloudflare dashboard
2. Navigate to **Email** → **Email Routing**
3. Add your domain and verify DNS records
4. Create a new route:
   - **Address**: `*@yourdomain.com` (or specific addresses)
   - **Action**: Send to Worker
   - **Worker**: Select your deployed worker

## ⚙️ Configuration

### Environment Variables

| Variable              | Description                            | Example                          |
| --------------------- | -------------------------------------- | -------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | Your Telegram bot token from BotFather | `123456789:ABCdef...`            |
| `TELEGRAM_CHANNEL_ID` | Your Telegram channel ID               | `@mychannel` or `-1001234567890` |

### Advanced Configuration

The worker includes several configuration constants you can modify:

```javascript
const CONFIG = {
  MAX_BODY_LENGTH: 4000, // Maximum body preview length
  MAX_SUBJECT_LENGTH: 100, // Maximum subject length in notifications
  TELEGRAM_MESSAGE_LIMIT: 4096, // Telegram's message limit
  RATE_LIMIT_WINDOW: 60000, // Rate limiting window (1 minute)
  MAX_EMAILS_PER_WINDOW: 10, // Max emails per sender per window
};
```

## 📋 How It Works

When an email arrives, the worker:

1. **🔍 Validates** the configuration and checks rate limits
2. **📊 Extracts** metadata (from, to, subject, date, message-id)
3. **🧠 Parses** the email content intelligently:
   - Detects multipart structure
   - Prioritizes text/plain over text/html
   - Decodes base64 and quoted-printable content
   - Handles various character encodings
4. **📤 Sends three Telegram messages**:
   - **Metadata message**: Sender, recipient, subject, etc.
   - **Body preview**: Clean, readable email content
   - **Full attachment**: Complete raw email as .txt file

## 📱 Telegram Output Example

```
📧 New Email Received

From: john@example.com
To: support@mydomain.com
Subject: Question about your service
Date: 2025-01-15T10:30:00Z
Content Type: text/plain
Message ID: abc123@example.com
```

```
📄 Email Content:

Hello,

I have a question about your service...
```

```
📎 Full email content: "Question about your service"
[email-abc123@example.com-2025-01-15.txt]
```

## 🔧 API Endpoints

### Health Check

```
GET https://your-worker.your-subdomain.workers.dev/health
```

Returns:

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
wrangler dev

# Run tests
npm test
```

### Testing Email Processing

```bash
# Send test email (requires configured email routing)
curl -X POST "https://your-worker.workers.dev" \
  -H "Content-Type: text/plain" \
  -d "Test email content"
```

## 🔒 Security Features

- **Rate Limiting**: Prevents spam attacks (configurable limits)
- **Input Validation**: Sanitizes all email content
- **Error Handling**: Graceful failure without exposing sensitive data
- **Markdown Escaping**: Prevents Telegram formatting injection
- **Content Size Limits**: Prevents oversized message failures

## 🚨 Troubleshooting

### Common Issues

#### ❌ "Configuration error"

- **Cause**: Missing or invalid environment variables
- **Solution**: Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL_ID` are set correctly

#### ❌ "Rate limit exceeded"

- **Cause**: Too many emails from the same sender
- **Solution**: Adjust rate limiting in configuration or wait for the window to reset

#### ❌ "Failed to send to Telegram"

- **Cause**: Invalid bot token or channel permissions
- **Solution**: Ensure bot is added as admin to the channel

#### ❌ "Processing failed"

- **Cause**: Malformed email or parsing error
- **Solution**: Check worker logs in Cloudflare dashboard

### Debug Mode

Set `DEBUG=true` in environment variables for verbose logging.

## 📊 Monitoring

Monitor your worker's performance:

1. **Cloudflare Dashboard**: View metrics, logs, and errors
2. **Health Endpoint**: Automated monitoring with `/health`
3. **Telegram Notifications**: Error alerts sent directly to your channel

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Email parsing inspired by modern email standards
- Telegram integration using [Bot API](https://core.telegram.org/bots/api)

## 💬 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/WhoisGray/cloudmail-to-telegram/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/WhoisGray/cloudmail-to-telegram/discussions)

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/WhoisGray">WhoisGray</a></p>
  <p>⭐ Star this repo if it helped you!</p>
</div>
