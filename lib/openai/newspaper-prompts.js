// AI prompts for multi-pass newspaper generation

const TOPIC_EXTRACTION_PROMPT = `Analyze these Discord messages and identify all distinct topics or discussions happening, even if it's just a single message without replies.

Requirements:
- No overlapping or duplicate topics
- Each topic should be genuinely unique and separate

Discord Messages:
{messages}

Respond with this JSON format:
{
  "topics": [
    {
      "id": "ruby-vs-rust-debate",
      "description": "Programming language discussion comparing Ruby and Rust for development"
    },
    {
      "id": "ai-tools-performance", 
      "description": "Users comparing Kimi vs Claude performance for deployment tasks"
    },
    {
      "id": "github-repo-share",
      "description": "User shared maybe-finance repository for personal finance management"
    }
  ]
}`

const FOCUSED_STORY_PROMPT = `You are a journalist writing for "The Daily Discord Times". 

Write a focused news story about this specific topic from Discord messages.

Topic to focus on: {topicDescription}

Requirements:
- Write a compelling headline focused ONLY on this topic
- Use direct quotes from users discussing this topic  
- IGNORE messages not related to this topic
- Include all relevant links/resources mentioned for this topic
- Use real usernames with exact quotes: "exact words," said username
- Write just long enough to cover everything discussed
- Format links as [descriptive text](url)

You have access to ALL channel messages - filter and focus on the relevant ones yourself.

Format:
## [Compelling Headline About This Topic]
*From #{channelName}*

[Story covering everything discussed with quotes and context]

[Include any resources mentioned for this topic]

All Channel Messages:
{messages}

Write a focused story about: {topicDescription}`

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
  TOPIC_EXTRACTION_PROMPT,
  FOCUSED_STORY_PROMPT,
  CATCHALL_STORY_PROMPT,
  LINK_COLLECTION_PROMPT
}
