// Updated prompts used for evaluation run #002
// Simplified topic extraction + non-tech + 3-step catchall + removed assembly

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

module.exports = {
  TOPIC_EXTRACTION_PROMPT,
  FOCUSED_STORY_PROMPT,
  CATCHALL_STORY_PROMPT
}
