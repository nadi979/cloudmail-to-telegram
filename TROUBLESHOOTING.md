# 🔧 Troubleshooting Guide

## 🚨 "Telegram API error: Not Found"

This is the most common error. Here's how to fix it step by step:

### 1. Verify Your Bot Token

Your bot token should look like: `123456789:ABCdefGHIjklMNopqRSTuvwXYZ1234567890`

**Test your bot token:**
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"
```

**Expected response:**
```json
{
  "ok": true,
  "result": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "YourBot",
    "username": "your_bot_username"
  }
}
```

### 2. Check Your Channel ID Format

Channel IDs can be in different formats:

| Format | Example | When to use |
|--------|---------|-------------|
| `@username` | `@mychannel` | Public channels with username |
| Numeric ID | `-1001234567890` | Private channels or groups |
| Chat ID | `1234567890` | Direct messages (not recommended) |

### 3. Get Your Correct Channel ID

#### Method 1: Using getUpdates API
1. Add your bot to your channel as admin
2. Send a test message to your channel  
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for your channel in the response:

```json
{
  "update_id": 123456789,
  "channel_post": {
    "message_id": 1,
    "chat": {
      "id": -1001234567890,  // ← This is your channel ID
      "title": "My Channel",
      "type": "channel"
    }
  }
}
```

#### Method 2: Forward a message
1. Forward any message from your channel to [@userinfobot](https://t.me/userinfobot)
2. It will show you the channel ID

#### Method 3: Using @RawDataBot
1. Add [@RawDataBot](https://t.me/RawDataBot) to your channel
2. Send any message
3. The bot will reply with the channel details including ID

### 4. Verify Bot Permissions

Your bot must be added to the channel as an **administrator** with these permissions:
- ✅ **Post messages**
- ✅ **Send media** (for file attachments)
- ✅ **Send stickers and GIFs** (optional)

**Steps to add bot as admin:**
1. Go to your Telegram channel
2. Click channel name → **Administrators**
3. Click **Add Administrator**
4. Search for your bot username
5. Grant required permissions
6. Click **Done**

### 5. Test Your Configuration

Create this test script to verify your setup:

```javascript
// test-telegram.js
const TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN_HERE";
const TELEGRAM_CHANNEL_ID = "YOUR_CHANNEL_ID_HERE";

async function testTelegram() {
  // Test 1: Bot info
  console.log("🤖 Testing bot token...");
  const botResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
  const botData = await botResponse.json();
  
  if (botData.ok) {
    console.log("✅ Bot token is valid:", botData.result.first_name);
  } else {
    console.log("❌ Invalid bot token:", botData.description);
    return;
  }
  
  // Test 2: Send message
  console.log("📤 Testing message sending...");
  const messageResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHANNEL_ID,
      text: "🧪 Test message from CloudMail-to-Telegram worker!"
    })
  });
  
  const messageData = await messageResponse.json();
  
  if (messageData.ok) {
    console.log("✅ Message sent successfully!");
  } else {
    console.log("❌ Failed to send message:");
    console.log("Error code:", messageData.error_code);
    console.log("Description:", messageData.description);
    
    // Common error explanations
    switch (messageData.error_code) {
      case 400:
        console.log("💡 This usually means invalid channel ID format");
        break;
      case 403:
        console.log("💡 Bot is not admin or doesn't have permission to post");
        break;
      case 404:
        console.log("💡 Channel not found or bot not added to channel");
        break;
    }
  }
}

testTelegram();
```

Run this in your browser console or Node.js to test your configuration.

## 🔤 Character Encoding Issues

If you see garbled characters like `Ã©`, `â¯`, `Ã `, this indicates UTF-8 encoding problems.

### Common Character Replacements

The updated worker now automatically fixes these common issues:

| Garbled | Correct | Character |
|---------|---------|-----------|
| `Ã©` | `é` | e with acute |
| `Ã ` | `à` | a with grave |
| `Ã¨` | `è` | e with grave |
| `Ã¹` | `ù` | u with grave |
| `Ã§` | `ç` | c with cedilla |
| `â¯` | ` ` | non-breaking space |
| `â` | `'` | smart quote |
| `â` | `"` | smart quote |

### Testing Encoding Fix

Send yourself an email with special characters and check if they appear correctly in Telegram.

## 🚀 Deploy the Fixed Version

1. Copy the updated worker code
2. Update your Cloudflare Worker
3. Test with the troubleshooting steps above

## 📞 Still Having Issues?

If you're still experiencing problems:

1. **Check Cloudflare Worker logs:**
   - Go to Cloudflare Dashboard
   - Navigate to Workers & Pages
   - Click your worker name
   - Check the "Logs" tab

2. **Enable debug mode:**
   ```bash
   wrangler secret put DEBUG
   # Enter: true
   ```

3. **Test step by step:**
   - First, test bot token with `/getMe`
   - Then, test sending a simple message
   - Finally, test the full email forwarding

4. **Common solutions:**
   - Re-create the bot token
   - Remove and re-add bot to channel
   - Try using numeric channel ID instead of @username
   - Check if channel is public or private

## 🔗 Useful Links

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#6-botfather)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

---

**Need more help?** Create an issue on GitHub with:
- Your error message (remove sensitive tokens)
- Steps you've already tried
- Whether bot token test passes