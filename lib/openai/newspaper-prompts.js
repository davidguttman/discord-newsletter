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
- Include topics with substance >= 1 as main stories
- Maximum 8 main topics per channel (focus on most substantial)
- Be specific in descriptions
- Even brief mentions can be topics if they're interesting

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

const CATCHALL_STORY_PROMPT = `You are a tech journalist writing for "The Daily Discord Times".

Write a brief "Community Highlights" section covering interesting content that wasn't part of the main discussion topics.

Focus on:
- Links and resources shared (YouTube videos, articles, tools, repos)
- Brief but valuable mentions and tips
- Single comments that contain useful information
- Random interesting tidbits that add value

Requirements:
- Only include content NOT covered in the main topic stories
- Keep it concise - 1-2 short paragraphs maximum
- Preserve ALL links mentioned: [descriptive text](url)
- Use format: "username mentioned [resource]" or "username shared [link]"
- Skip if there's nothing substantial to report

Format:
## Community Highlights
*Quick mentions and resources from around the channel*

[Brief paragraph covering links, resources, and interesting one-off comments]

Main Topic Stories (DO NOT repeat this content):
{mainStories}

All Channel Messages:
{messages}

Write the Community Highlights section:`

const NEWSPAPER_ASSEMBLY_PROMPT = `You are the editor-in-chief of "The Daily Discord Times".

Combine these individual topic stories and community highlights into a cohesive newspaper article for this channel.

Tasks:
1. Order main stories by importance/interest (most engaging first)
2. Add brief channel summary if there are multiple stories
3. Place Community Highlights section after main stories
4. Combine any duplicate resources mentioned across all sections
5. Add final resources section with all links mentioned

Format:
# Daily Report: #{channelName}

[Brief intro if multiple topics, otherwise skip]

{main stories in order of importance}

{community highlights section}

---

## 📚 Resources Mentioned
- [Resource Name](url) - Brief description

Channel Content:
{stories}

Create a cohesive newspaper article for this channel:`

module.exports = {
  TOPIC_EXTRACTION_PROMPT,
  FOCUSED_STORY_PROMPT,
  CATCHALL_STORY_PROMPT,
  NEWSPAPER_ASSEMBLY_PROMPT
}
