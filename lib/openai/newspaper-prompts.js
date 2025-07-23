// AI prompts for multi-pass newspaper generation

const TOPIC_EXTRACTION_PROMPT = `Analyze these Discord messages and identify distinct topics or conversations happening.

Look for:
- Technical discussions about tools, languages, frameworks
- Project shares and demos
- Community events or announcements  
- Debates or comparisons
- Resource sharing (links, repos, articles)

For each topic, provide:
1. A brief topic description (1 sentence)
2. How substantial the discussion was (1-5 scale, where 5 = very active discussion, 1 = brief mention)
3. Main theme category (tech-discussion, project-share, event, debate, resource-share, etc.)

Requirements:
- Only identify topics with substance >= 2 (ignore single-message mentions)
- Maximum 5 topics per channel (focus on most substantial)
- Be specific in descriptions

Discord Messages:
{messages}

Respond with this JSON format:
{
  "topics": [
    {
      "id": "ruby-vs-rust-debate",
      "description": "Programming language discussion comparing Ruby and Rust for development",
      "substance": 4,
      "category": "tech-discussion"
    },
    {
      "id": "ai-tools-performance",
      "description": "Users comparing Kimi vs Claude performance for deployment tasks", 
      "substance": 3,
      "category": "debate"
    },
    {
      "id": "github-repo-share",
      "description": "User shared maybe-finance repository for personal finance management",
      "substance": 2, 
      "category": "project-share"
    }
  ]
}`

const FOCUSED_STORY_PROMPT = `You are a tech journalist writing for "The Daily Discord Times". 

Write a focused news story about this specific topic from Discord messages.

Topic to focus on: {topicDescription}
Topic category: {category}

Requirements:
- Write a compelling headline focused ONLY on this topic
- Use direct quotes from users discussing this topic  
- IGNORE messages not related to this topic
- Include all relevant links/resources mentioned for this topic
- Use real usernames with exact quotes: "exact words," said username
- Write 1-3 paragraphs depending on discussion depth
- Format links as [descriptive text](url)

You have access to ALL channel messages - filter and focus on the relevant ones yourself.

Format:
## [Compelling Headline About This Topic]
*From #{channelName}*

[1-3 paragraph focused story with quotes and context]

[Include any resources mentioned for this topic]

All Channel Messages:
{messages}

Write a focused story about: {topicDescription}`

const NEWSPAPER_ASSEMBLY_PROMPT = `You are the editor-in-chief of "The Daily Discord Times".

Combine these individual topic stories into a cohesive newspaper article for this channel.

Tasks:
1. Order stories by importance/interest (most engaging first)
2. Add brief channel summary if there are multiple stories
3. Combine any duplicate resources mentioned across stories
4. Ensure flow between stories makes sense
5. Add final resources section with all links mentioned

Format:
# Daily Report: #{channelName}

[Brief intro if multiple topics, otherwise skip]

{individual stories in order of importance}

---

## 📚 Resources Mentioned
- [Resource Name](url) - Brief description

Channel Stories:
{stories}

Create a cohesive newspaper article for this channel:`

module.exports = {
  TOPIC_EXTRACTION_PROMPT,
  FOCUSED_STORY_PROMPT,
  NEWSPAPER_ASSEMBLY_PROMPT
}
