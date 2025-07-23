// AI prompts for multi-pass newspaper generation

const MESSAGE_GROUPING_PROMPT = `Analyze these Discord messages and group them into topics with the actual messages.

Task: Group messages by topic and assign each message to exactly one topic.

Requirements:
- Each message must be assigned to exactly one topic
- Create topics that capture the actual discussions happening
- Include all message details: ID, timestamp, username, content
- Use descriptive topic names that explain what's being discussed
- Group related messages together even if they're not replies to each other

Discord Messages:
{messages}

Respond with this JSON format:
{
  "topic_groups": {
    "AI Tools and Performance Discussion": [
      {
        "id": "msg_1",
        "timestamp": "[7/21/2025, 5:02:48 PM]",
        "username": "mittens4025", 
        "content": "MCP doesn't care how long running your tool calls are. The frameworks usually do."
      },
      {
        "id": "msg_2",
        "timestamp": "[7/21/2025, 5:08:04 PM]",
        "username": "ngamolsky9602",
        "content": "When you say frameworks what do you mean? Im wondering specifically about Claude Desktop as a client."
      }
    ],
    "Programming Language Preferences": [
      {
        "id": "msg_15",
        "timestamp": "[7/22/2025, 12:14:02 AM]",
        "username": "yikesawjeez",
        "content": "im not rubypilled but i hope to be when i grow up"
      }
    ]
  }
}`

const STORY_WRITING_PROMPT = `Write brief tech news stories from these Discord messages. Use actual usernames for attribution.

Topic: {topicName}

Style requirements:
- Write short, direct headlines (no fluff words like "sparks" or "emerges")
- Lead with the main fact or development
- Use actual usernames: "xr0am reported" not "a developer reported"  
- Include relevant quotes when they add key information
- Keep stories 2-3 sentences maximum
- No journalistic flourishes or commentary
- Include URLs if mentioned

Topic Messages:
{topicMessages}

Write direct tech news stories with real names:`

const CATCHALL_STORY_PROMPT = `You are a journalist writing for "The Daily Discord Times".

Step 1: Identify all messages from Discord that are not covered by the provided news stories
Step 2: For each uncovered message, decide whether it's just fluff/agreement/social chatter
Step 3: For each non-fluff message, write it in journalistic style - describe what happened and provide a direct quote (part or all of the message) with attribution

Format:
## Community Highlights
*Additional noteworthy mentions from around the channel*

[For each significant uncovered message: brief description of what happened, then direct quote with attribution]

Main Topic Stories (DO NOT repeat this content):
{mainStories}

All Channel Messages:
{messages}

Write the Community Highlights section:`

const LINK_COLLECTION_PROMPT = `You are a researcher collecting links and resources from Discord messages.

Step 1: Extract ALL links/URLs/shared resources from the Discord messages
Step 2: For each link, determine which news story or highlight section (if any) it relates to
Step 3: Provide a description and confidence score for each link

Requirements:
- Find EVERY link in the original messages - don't miss any
- Only describe links that actually exist in the messages
- NEVER make up or invent URLs that aren't in the original messages

Format for each link:
{
  "url": "exact URL from messages",
  "description": "what this link is about",
  "associated_story": "topic name or 'community_highlights' or 'none'",
  "confidence": "low/medium/high - how sure you are about the association"
}

Discord Messages:
{messages}

News Stories and Highlights:
{stories}

Return JSON array of all links found:`

module.exports = {
  MESSAGE_GROUPING_PROMPT,
  STORY_WRITING_PROMPT,
  CATCHALL_STORY_PROMPT,
  LINK_COLLECTION_PROMPT
}
