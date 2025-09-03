# Newsletter Prompt Strategies for Discord Message Processing

This document outlines three different approaches for creating AI prompts to generate newsletters from Discord messages, each optimized for capturing ALL links, proper quote attribution, and removing fluff while maintaining narrative flow.

## Strategy 1: Multi-Step Deterministic Pipeline (O3 Model Recommendation)

### Overview
4-step pipeline that separates deterministic extraction from AI processing to guarantee completeness.

### Implementation Steps

**Step 0: Raw Message Ingestion**
- Persist raw Discord messages exactly as received
- No processing, just storage for audit trail

**Step 1: Deterministic Parser (Pure Code, No LLM)**
```javascript
function extractMessageData(messages) {
  return messages.map(msg => ({
    id: msg.id,
    author: msg.authorUsername,
    timestamp: msg.createdAt.toISOString(),
    content: msg.content,
    links: extractAllUrls(msg.content, msg.embeds, msg.attachments),
    is_reply_to: msg.replyToId,
    thread_id: msg.threadId,
    thread_name: msg.threadName
  }))
}

function extractAllUrls(content, embeds = [], attachments = []) {
  const contentUrls = content?.match(/https?:\/\/[^\s]+/g) || []
  const embedUrls = embeds.map(e => e.url).filter(Boolean)
  const attachmentUrls = attachments.map(a => a.url).filter(Boolean)
  return [...contentUrls, ...embedUrls, ...attachmentUrls]
}
```

**Step 2: Message Classification (Lightweight LLM)**
```javascript
const classificationPrompt = `
Classify each message with ONE tag:
- link_share: Contains URLs or resources
- quote_worthy: Substantive statements worth quoting
- context: Provides important context
- filler: Casual chat, greetings, reactions

Input: ${JSON.stringify(messages)}
Output: Array of {id, tag} objects only.
`
```

**Step 3: Newsletter Generation (Full LLM)**
```javascript
const newsletterPrompt = `
System: You are NewsBot, converting Discord discussions to newsletter format.

RULES:
1. Every URL in links[] arrays MUST appear exactly once in "Resources" section
2. Pull 3-5 illustrative quotes from quote_worthy messages
3. Format quotes as: "> quote" — @author (thread, YYYY-MM-DD HH:MM)
4. Remove casual chatter unless part of a quote
5. Preserve chronological narrative but condense aggressively

INPUT: ${JSON.stringify(classifiedMessages)}

OUTPUT FORMAT:
# {Date} Community AI Round-Up

## Key Stories
- Story 1: {theme}
- Story 2: {theme}

## Notable Quotes
> "{quote}" — @author (thread, timestamp)

## Resources Shared
- [title](url) — context
`
```

### Advantages
- Guarantees 0% link loss through deterministic extraction
- Unit testable extraction layer
- Reduces prompt complexity
- Separates concerns cleanly

### Unit Testing Strategy
```javascript
// Test deterministic extractor
function testLinkExtraction() {
  const testMessage = {
    content: "Check out https://example.com and <https://hidden.com>",
    embeds: [{url: "https://embed.com"}],
    attachments: [{url: "https://file.com"}]
  }
  
  const extracted = extractAllUrls(testMessage.content, testMessage.embeds, testMessage.attachments)
  const expected = ["https://example.com", "https://hidden.com", "https://embed.com", "https://file.com"]
  
  assert.deepEqual(extracted, expected)
}
```

---

## Strategy 2: Structured Extraction Chain (GPT-4.1 Recommendation)

### Overview  
Multi-step segmented prompting with explicit instructions for each extraction task.

### Implementation Approach

**Step 1: Data Preprocessing**
```javascript
function formatThreadForLLM(conversation) {
  return `
THREAD: ${conversation.threadName || 'Main Channel'}
PARTICIPANTS: ${conversation.participants.join(', ')}
MESSAGES: ${conversation.messageCount}

${conversation.messages.map(msg => `
[${new Date(msg.createdAt).toLocaleString()}] @${msg.authorUsername}:
${msg.content}
${msg.replyToId ? `↳ Reply to: ${msg.replyToId}` : ''}
${msg.attachments?.length ? `📎 Attachments: ${msg.attachments.map(a => a.filename).join(', ')}` : ''}
`).join('\n')}
---
`
}
```

**Step 2: Segmented Extraction Prompt**
```javascript
const segmentedPrompt = `
Given the following Discord conversation thread:

${formattedThread}

Perform these tasks in order:

## TASK 1: Extract and Contextualize All Links/Resources
For every message, extract all URLs, attachments, or shared resources.
For each link/resource, provide:
- The author (username)  
- The timestamp
- The immediate conversational context
- Cross-references if mentioned later

## TASK 2: Extract Direct Quotes with Attribution
Identify significant statements worth quoting.
For each, provide:
- The quoted text
- The author (username)
- The timestamp  
- The context (what prompted it, relevance)

## TASK 3: Summarize Essential Content
Summarize main points preserving narrative flow.
Remove casual chatter, greetings, jokes, off-topic remarks.
Link back to extracted links and quotes.

## OUTPUT FORMAT:
### Links/Resources:
[detailed list with context]

### Quotes:  
[detailed list with attribution]

### Essential Summary:
[narrative summary referencing links/quotes]
`
```

### Validation Step
```javascript
function validateCompleteness(originalData, extractedData) {
  const originalLinks = getAllLinksFromData(originalData)
  const extractedLinks = getAllLinksFromOutput(extractedData)
  
  const missedLinks = originalLinks.filter(link => !extractedLinks.includes(link))
  
  if (missedLinks.length > 0) {
    throw new Error(`Missed links: ${missedLinks.join(', ')}`)
  }
  
  return true
}
```

### Advantages
- Clear task separation reduces cognitive load
- Context windows provide better understanding
- Metadata enables precise attribution
- Systematic coverage reduces omissions

---

## Strategy 3: Three-Stage Extract-and-Synthesize Pipeline (Gemini Recommendation)

### Overview
Hybrid approach combining deterministic pre-processing with two-step LLM chain.

### Stage 0: Deterministic Pre-processing
```javascript
function preprocessForGemini(messageMap) {
  return messageMap.conversations.map(conv => {
    const markdown = `
# ${conv.threadName || 'Main Channel Conversation'}
**Participants:** ${conv.participants.join(', ')}
**Duration:** ${new Date(conv.startTime).toLocaleString()} - ${new Date(conv.endTime).toLocaleString()}

---

${conv.messages.map(msg => {
  const timestamp = new Date(msg.createdAt).toLocaleString()
  const links = extractAllUrls(msg.content, msg.embeds, msg.attachments)
  const attachments = msg.attachments || []
  
  return `
**[${timestamp}] ${msg.authorUsername}:** ${msg.content}
${links.map(link => `> **[Link Found]** ${link}`).join('\n')}
${attachments.map(att => `> **[Attachment Found]** ${att.filename}`).join('\n')}
${msg.replyToId ? `↳ *Reply to previous message*` : ''}
`
}).join('\n')}

---
`
  }).join('\n\n')
}
```

### Stage 1: Information Extraction (LLM Call #1)
```javascript
const extractionPrompt = `
You are an AI assistant extracting key information from Discord conversations.

Analyze the conversation and extract into structured JSON:

{
  "main_topics": ["topic1", "topic2", "topic3"],
  "key_quotes": [
    {
      "quote": "exact quote text",
      "author": "username", 
      "context": "why this quote is significant"
    }
  ],
  "shared_resources": [
    {
      "resource": "url or filename",
      "context": "purpose/discussion context from conversation"
    }
  ],
  "summary": "one paragraph neutral summary of conversation outcome"
}

CRITICAL: Ensure every single [Link Found] and [Attachment Found] appears in shared_resources.
Do not write a story. Output only valid JSON.

<conversation>
${preprocessedMarkdown}
</conversation>

<json_output>
`
```

### Stage 2: Narrative Synthesis (LLM Call #2)  
```javascript
const synthesisPrompt = `
You are a tech journalist writing for an internal engineering newsletter.
Tone: informative, concise, engaging.

Using the structured data below, write a news story:

REQUIREMENTS:
- Create compelling headline
- Weave summary, topics, quotes, resources into coherent narrative  
- Quote format: "Quote text." — @Author
- Present all resources in bulleted "Key Resources" section
- Include every quote and resource from input data
- Output in Markdown format

<structured_data>
${JSON.stringify(extractedData, null, 2)}
</structured_data>

<newsletter_story>
# [Your headline here]

[Your story here]

## Key Resources
- [Resource](link) - context

<newsletter_story>
`
```

### Advantages
- Deterministic pre-processing guarantees link capture
- JSON extraction separates analysis from synthesis
- Two-stage approach reduces complexity per step
- Markdown formatting improves LLM comprehension
- Explicit resource tagging prevents missed items

### Error Handling
```javascript
function validateJSONExtraction(jsonOutput) {
  try {
    const parsed = JSON.parse(jsonOutput)
    
    // Validate required fields
    const required = ['main_topics', 'key_quotes', 'shared_resources', 'summary']
    const missing = required.filter(field => !parsed[field])
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
    
    return parsed
  } catch (e) {
    throw new Error(`Invalid JSON extraction: ${e.message}`)
  }
}
```

---

## Implementation Recommendations

### For Your Message Map Structure
Your existing `message-map-2025-07-24.json` structure works well with all three approaches:

- **conversations** array provides thread groupings
- **Complete message metadata** enables precise attribution  
- **Reply chains and thread hierarchies** maintain narrative context
- **Rich Discord data** includes all necessary link/attachment info

### Testing Strategy
1. **Unit test extractors** with edge cases (malformed URLs, embedded links, etc.)
2. **Integration test** with your 3-day message map
3. **Validation checks** to ensure 100% link/resource recall
4. **A/B test** different approaches on same data set

### Next Steps
1. Implement one approach using your existing message map
2. Create validation pipeline to check completeness
3. Compare outputs from different strategies
4. Optimize prompts based on results

---

## Conclusion

All three strategies address your core requirements but with different trade-offs:

- **Strategy 1** (O3): Most reliable, deterministic, testable
- **Strategy 2** (GPT-4.1): Balanced, explicit instructions, good context handling  
- **Strategy 3** (Gemini): Clean separation, JSON structure, good error handling

Choose based on your priorities: maximum reliability (Strategy 1), balanced approach (Strategy 2), or clean architecture (Strategy 3).