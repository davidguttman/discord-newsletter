// DSPy-optimized prompts based on evaluation feedback

// ORIGINAL MESSAGE_GROUPING_PROMPT had issues with:
// - Too much fragmentation (7 groups instead of optimal 5)
// - Some overlap between topics
// - Less distinct categories

const OPTIMIZED_MESSAGE_GROUPING_PROMPT = `Analyze these Discord messages and group them into 5-6 coherent topics with minimal overlap.

Task: Create broad, distinct topic categories that capture the main discussions without fragmentation.

GROUPING STRATEGY:
- Aim for 5-6 major topic groups (not more)
- Combine related discussions (frameworks + tools = one group)
- Use clear, non-overlapping category names
- Each message must be assigned to exactly one topic
- Prioritize logical coherence over strict separation

CATEGORY EXAMPLES:
- "AI Frameworks and Development Tools" (combine MCP, Claude, coding tools)
- "API Usage and Data Services" (pricing, providers, usage stats)
- "Community Events and Announcements" (talks, updates, news)
- "Personal Experiences and Recommendations" (user reports, suggestions)  
- "Open Source Projects and Discussion" (repositories, tools, debates)

Discord Messages:
{messages}

Respond with this JSON format:
{
  "topic_groups": {
    "AI Frameworks and Development Tools": [
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
    "API Usage and Data Services": [
      {
        "id": "msg_15",
        "timestamp": "[7/22/2025, 12:44:10 AM]",
        "username": "mdcker",
        "content": "ChatGPT users send 2.5 billion prompts a day"
      }
    ]
  }
}`

// Export for use in your Node.js workflow
module.exports = {
  OPTIMIZED_MESSAGE_GROUPING_PROMPT
}
