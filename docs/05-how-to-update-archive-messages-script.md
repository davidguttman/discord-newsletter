# How to Update the v1 Archive Messages Script

This guide details the steps required to update the `archive-messages.js` script from the `v1` branch to function correctly with the current application structure, primarily focusing on integrating with the new MongoDB setup using Mongoose.

**Original v1 Script Dependencies:**

*   `discord.js-selfbot-v13`
*   `dotenv`
*   `../lib/db` (Custom simple DB wrapper)

**New Dependencies Required:**

*   `discord.js-selfbot-v13` (Remains the same)
*   `dotenv` (Remains the same)
*   `mongoose` (via `../lib/mongo`)
*   `../models/message` (Mongoose model for messages)
*   *(Optional: `../config` if you need other config values, though `DISCORD_TOKEN` is still read directly from `process.env`)*

## Step-by-Step Update Guide

1.  **Copy the Original Script:**
    Start by getting the `scripts/archive-messages.js` file from the `v1` branch and place it in the `scripts/` directory of your current project structure.

2.  **Update `require` Statements:**
    Modify the top of the file to remove the old `db` require and add the new requirements for Mongoose and the Message model.

    *Remove:*
    ```javascript
    const db = require('../lib/db')
    ```

    *Add:*
    ```javascript
    const mongoose = require('../lib/mongo') // Connects to MongoDB
    const Message = require('../models/message') // Message schema/model
    ```
    *Ensure `dotenv` is still required:*
    ```javascript
    require('dotenv').config()
    ```

3.  **Modify Database Interaction in `archiveChannelMessages`:**
    The core change is how messages are saved. Replace the old `db.saveMessage(message)` call with the Mongoose logic to create or update a message document.

    *Inside the `archiveChannelMessages` function, find this block:*
    ```javascript
    // Original v1 code
    if (message.createdAt <= options.end && message.createdAt >= options.start) {
      const result = await db.saveMessage(message) // <--- This line needs changing
      stats.total++
      if (result.wasUpdated) stats.updated++
      if (result.wasInserted) stats.new++

      // ... rest of the loop
    }
    ```

    *Replace `const result = await db.saveMessage(message)` with the following Mongoose logic:*
    ```javascript
    if (message.createdAt <= options.end && message.createdAt >= options.start) {
      // --- New Mongoose Saving Logic START ---
      const messageData = {
        id: message.id,
        content: message.content,
        authorId: message.author.id,
        authorUsername: message.author.username,
        channelId: message.channel.id,
        channelName: message.channel.name,
        guildId: message.guild?.id,
        guildName: message.guild?.name,
        threadId: message.channel.isThread() ? message.channel.id : null,
        parentId: message.channel.isThread() ? message.channel.parentId : message.channel.id, // Use channel ID if not thread
        createdAt: message.createdAt,
        updatedAt: message.editedAt || message.createdAt, // Use editedAt if available
        replyToId: message.reference?.messageId || null,
        mentionsReplyTarget: !!(message.reference?.messageId && message.mentions?.repliedUser), // Check if the reply pinged the user
        attachments: Array.from(message.attachments.values()).map(a => ({
          id: a.id,
          url: a.url,
          name: a.name,
          size: a.size
        })),
        embeds: message.embeds.map(e => ({
          type: e.type,
          title: e.title,
          description: e.description,
          url: e.url
          // Note: The schema might not capture all embed fields (e.g., fields, footer, image, etc.)
          // Adjust the mapping here and in `models/message.js` if more detail is needed.
        }))
      }

      const result = await Message.findOneAndUpdate(
        { id: message.id }, // Find message by its Discord ID
        { $set: messageData }, // Set the data (update)
        { upsert: true, new: true, setDefaultsOnInsert: true } // Options: Insert if not found, return new doc, apply schema defaults
      )

      const wasInserted = !result.__v // __v is 0 for new documents created by Mongoose `upsert`
      const wasUpdated = !wasInserted

      // --- New Mongoose Saving Logic END ---

      stats.total++
      if (wasUpdated) stats.updated++
      if (wasInserted) stats.new++

      // ... rest of the loop
    }
    ```
    *Note:* The `parentId` mapping assumes you want the main channel ID if the message is not in a thread. Adjust if needed. The `mentionsReplyTarget` logic is slightly adapted based on typical `discord.js` properties for replies.

4.  **Update Database Disconnect:**
    Replace the old `db.disconnect()` call with the Mongoose disconnect method.

    *Inside the `archiveMessages` function, in the `finally` block, find:*
    ```javascript
    // Original v1 code
    await db.disconnect()
    ```

    *Replace with:*
    ```javascript
    // New Mongoose disconnect
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
    ```

5.  **Verify Environment Variables:**
    Ensure your `.env` file contains the `DISCORD_TOKEN` and the correct MongoDB connection variables (`MONGO_URI`, `MONGO_DB_NAME`). The script relies on `dotenv` to load these. The `lib/mongo/mongo.js` file handles the actual connection using these variables.

6.  **Testing:**
    Run the updated script with the required arguments (e.g., `--start`, `--end`, `--channel`, `--guild`). Monitor the console output for any errors during connection, fetching, or saving. Check your MongoDB database to confirm messages are being saved correctly according to the `Message` schema.

    ```bash
    node scripts/archive-messages.js --start YYYY-MM-DD --end YYYY-MM-DD --channel YOUR_CHANNEL_ID --guild YOUR_GUILD_ID
    ```

This updated script now leverages the centralized Mongoose connection and the defined `Message` model, aligning it with the rest of the application's data handling practices.
