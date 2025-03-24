# Discord Newsletter

This service automatically listens for and saves every Discord message (including threads) from configured guild channels to a MongoDB database.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create your environment configuration:
```bash
cp .env.example .env
```

3. Edit the `.env` file with your configuration:
```ini
# Discord configuration
DISCORD_TOKEN=your-discord-token-here
GUILD_CHANNELS=guildId1:channelId1,guildId2:channelId2

# MongoDB configuration
MONGO_URI=mongodb://localhost:27017/discord-export
```

The `GUILD_CHANNELS` format is `guildId:channelId` pairs separated by commas. This ensures messages are only captured from specific channels within specific guilds.

## Usage

### Live Message Archival
Start the service to archive messages in real-time:
```bash
npm start
```

The service will:
- Connect to Discord using your token
- Listen for messages in the configured guild channels
- Save all messages to MongoDB, including:
  - Message content
  - Author information
  - Channel/Thread information
  - Attachments
  - Embeds
  - Timestamps

### Historical Message Archival
Archive messages from a specific time range:
```bash
npm run archive -- --start 2024-03-20 --end 2024-03-21 --channel 123456789 --guild 987654321
```

Options:
- `--start`: Start date (ISO format, e.g. 2024-03-20)
- `--end`: End date (ISO format, e.g. 2024-03-21)
- `--channel`: Channel ID to archive
- `--guild`: Guild ID the channel belongs to
- `--help`: Show help message

The archive script will:
1. Connect to Discord using your token
2. Fetch messages from the specified channel within the date range
3. Save them to the configured MongoDB database
4. Display progress and completion statistics

## Testing

Run the tests:
```bash
npm test
```

## Data Structure

Messages are stored in MongoDB with the following schema:

```javascript
{
  id: String,              // Discord message ID
  content: String,         // Message content
  authorId: String,        // Author's Discord ID
  authorUsername: String,  // Author's username
  channelId: String,      // Channel ID
  guildId: String,        // Guild ID
  threadId: String,       // Thread ID (if message is in a thread)
  parentId: String,       // Parent channel ID (if message is in a thread)
  createdAt: Date,        // Message creation timestamp
  updatedAt: Date,        // Message last edit timestamp
  replyToId: String,      // ID of message being replied to (if this is a reply)
  mentionsReplyTarget: Boolean, // Whether the reply mentions original message author
  attachments: [{         // Array of attachments
    id: String,
    url: String,
    name: String,
    size: Number
  }],
  embeds: [{             // Array of embeds
    type: String,
    title: String,
    description: String,
    url: String
  }]
}
```

## Querying Messages

### Finding Messages in Threads

To find messages in threads using MongoDB, you can use these example queries:

```javascript
// Find all messages in any thread
db.messages.find({ threadId: { $ne: null } })

// Find messages in a specific thread
db.messages.find({ threadId: "thread-id-here" })

// Find all messages in threads under a specific channel
db.messages.find({ parentId: "channel-id-here" })

// Find messages in threads, sorted by creation time
db.messages.find({ threadId: { $ne: null } })
  .sort({ createdAt: -1 })

// Group messages by thread and count them
db.messages.aggregate([
  { $match: { threadId: { $ne: null } } },
  { $group: {
    _id: "$threadId",
    messageCount: { $sum: 1 },
    firstMessage: { $first: "$content" },
    lastMessageTime: { $max: "$createdAt" }
  }}
])
``` 