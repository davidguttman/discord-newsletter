# Message Tagging Feature

This feature allows you to categorize and filter Discord messages with tags, making it easier to organize content and create focused newsletters on specific topics.

## Overview

The tagging system includes:

- Tag management (create, update, delete tags)
- Assigning tags to messages
- Filtering messages by tags
- Tag-based email templates
- Focused summaries based on selected tags

## API Endpoints

### Tags Management

| Endpoint    | Method | Description              |
| ----------- | ------ | ------------------------ |
| `/tags`     | GET    | Get all available tags   |
| `/tags/:id` | GET    | Get a specific tag by ID |
| `/tags`     | POST   | Create a new tag         |
| `/tags/:id` | PUT    | Update an existing tag   |
| `/tags/:id` | DELETE | Delete a tag             |

### Message Tags

| Endpoint                               | Method | Description                            |
| -------------------------------------- | ------ | -------------------------------------- |
| `/message-tags/:messageId/tags/:tagId` | POST   | Add a tag to a message                 |
| `/message-tags/:messageId/tags/:tagId` | DELETE | Remove a tag from a message            |
| `/message-tags/:messageId/tags`        | GET    | Get all tags for a message             |
| `/message-tags/bulk-tag`               | POST   | Add a tag to multiple messages at once |

### Summaries with Tags

The existing endpoints have been enhanced to support tag filtering:

- **GET** `/summarize/channel/:channelId` - Add `?tags=tagId1,tagId2` to filter messages by tags
- **POST** `/email-summary/channel/:channelId` - Add `tags` parameter to filter messages and focus the summary

## Examples

### Creating a Tag

```
POST /tags
{
  "name": "announcement",
  "color": "#FF5733",
  "description": "Important announcements from team members"
}
```

### Tagging a Message

```
POST /message-tags/1234567890/tags/60f8a9b7c36d453a7f8a9b7c
```

### Bulk Tagging Messages

```
POST /message-tags/bulk-tag
{
  "messageIds": ["1234567890", "0987654321", "1122334455"],
  "tagId": "60f8a9b7c36d453a7f8a9b7c"
}
```

### Getting a Filtered Summary

```
GET /summarize/channel/1234567890?startDate=2023-06-01&endDate=2023-06-30&tags=60f8a9b7c36d453a7f8a9b7c,60f8a9b7c36d453a7f8a9b7d
```

### Sending a Tagged Email Summary

```
POST /email-summary/channel/1234567890
{
  "to": "user@example.com",
  "since": "7d",
  "tags": "60f8a9b7c36d453a7f8a9b7c,60f8a9b7c36d453a7f8a9b7d",
  "templateName": "newsletter"
}
```

## Email Templates

Three email templates are available:

1. **default** - Standard template with detailed metadata
2. **compact** - Minimalist design for smaller screens
3. **newsletter** - Professional newsletter layout

You can specify the template in the `templateName` parameter when sending email summaries.

## Focused Summaries

When you filter by tags, the AI summary is automatically focused on the topics represented by those tags, providing more relevant content in your summaries and newsletters.

## Integration with the Rest of the Application

The tagging system integrates with the existing message fetching and summarization functionality, allowing for more organized and targeted newsletters based on specific topics or categories of interest in your Discord channels.
