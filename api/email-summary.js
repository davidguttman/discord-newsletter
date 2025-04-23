const express = require("express");
const ms = require("ms");
const autoCatch = require("../lib/auto-catch");
const Message = require("../models/message");
const messageFormatter = require("../lib/message-formatter");
const openai = require("../lib/openai");
const email = require("../lib/email");
const marked = require("marked");
const mongoose = require("mongoose");
const Tag = require("../models/tag");

const router = express.Router();

// Send email summary of channel messages
router.post(
  "/channel/:channelId",
  autoCatch(async (req, res) => {
    const { channelId } = req.params;
    const { to, since, format, model, maxTokens, tags, templateName } =
      req.body;

    // Validate required parameters
    if (!to) {
      return res
        .status(400)
        .json({ error: "Email recipient (to) is required" });
    }

    if (!since) {
      return res.status(400).json({ error: "Time period (since) is required" });
    }

    // Calculate start date based on 'since' parameter
    let duration;
    try {
      duration = ms(since);
      if (!duration) {
        return res
          .status(400)
          .json({
            error:
              'Invalid time period format. Use values like "24h", "1d", "7d", etc.',
          });
      }
    } catch (err) {
      return res
        .status(400)
        .json({
          error:
            'Invalid time period format. Use values like "24h", "1d", "7d", etc.',
        });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - duration);

    // Build query
    const query = { channelId };
    query.createdAt = {
      $gte: startDate,
      $lte: endDate,
    };

    // Filter by tags if provided
    if (tags) {
      const tagIds = tags
        .split(",")
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (tagIds.length > 0) {
        query.tags = { $in: tagIds };
      }
    }

    console.log("query", query);

    // Get messages
    const messages = await Message.find(query)
      .populate("tags")
      .sort({ createdAt: 1 });

    if (messages.length === 0) {
      return res.status(404).json({
        error: "No messages found for the specified channel and time range",
      });
    }

    console.log("messages", messages.slice(0, 10));

    // Format messages into a readable conversation
    const formattedMessages = messageFormatter.formatMessages(messages, {
      format: "txt",
    });

    console.log("formattedMessages", formattedMessages.slice(0, 500));

    // Generate summary using OpenAI
    const options = {};
    if (model) options.model = model;
    if (maxTokens) options.maxTokens = parseInt(maxTokens);

    // If tags are provided, request a more focused summary on those tagged topics
    if (tags) {
      const tagObjects = await Tag.find({ _id: { $in: tags.split(",") } });
      if (tagObjects.length > 0) {
        options.focusPrompt = `Focus on discussions related to these topics: ${tagObjects
          .map((t) => t.name)
          .join(", ")}.`;
      }
    }

    const summary = await openai.summarizeMessages(formattedMessages, options);

    // Format email subject
    const startDateStr = startDate.toLocaleDateString();
    const endDateStr = endDate.toLocaleDateString();

    // Add tag information to subject if filtering by tags
    let subject = `Discord Channel Summary (${startDateStr} to ${endDateStr})`;
    if (tags) {
      const tagObjects = await Tag.find({ _id: { $in: tags.split(",") } });
      if (tagObjects.length > 0) {
        subject += ` - ${tagObjects.map((t) => t.name).join(", ")}`;
      }
    }

    // Get template if provided
    let template = templateName || "default";

    // Send email
    const emailResult = await sendChannelSummaryEmail({
      to,
      subject,
      summary: summary.summary,
      metadata: {
        channelId,
        startDate,
        endDate,
        messageCount: messages.length,
        tags: tags
          ? messages
              .flatMap((m) => m.tags)
              .filter(
                (tag, index, self) =>
                  index ===
                  self.findIndex((t) => t._id.toString() === tag._id.toString())
              )
          : [],
      },
      format: format || "html",
      template,
    });

    res.json({
      success: true,
      channelId,
      to,
      startDate,
      endDate,
      messageCount: messages.length,
      tagFilters: tags ? tags.split(",") : null,
      emailId: emailResult.id,
    });
  })
);

// Helper function to send summary email
async function sendChannelSummaryEmail({
  to,
  subject,
  summary,
  metadata,
  format,
  template,
}) {
  // For plain text format
  const textContent = `
Discord Channel Summary
======================

Channel ID: ${metadata.channelId}
Date Range: ${metadata.startDate.toLocaleDateString()} to ${metadata.endDate.toLocaleDateString()}
Messages Processed: ${metadata.messageCount}
${
  metadata.tags.length > 0
    ? `Tags: ${metadata.tags.map((tag) => tag.name).join(", ")}`
    : ""
}

${summary}

Generated on ${new Date().toLocaleDateString()}
  `.trim();

  // If HTML format is requested
  if (format === "html") {
    // Process markdown content
    let processedContent = summary;
    if (summary.includes("```markdown")) {
      processedContent = summary.replace(/```markdown\n([\s\S]*?)```/g, "$1");
    }
    const htmlContent = renderHtmlSummary(processedContent, metadata, template);

    return email.sendEmail({
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });
  }

  // Otherwise send text-only email
  return email.sendEmail({
    to,
    subject,
    text: textContent,
  });
}

// Helper function to render HTML summary
function renderHtmlSummary(markdownContent, metadata, template = "default") {
  const htmlContent = marked.parse(markdownContent);

  // Generate tags HTML if tags are present
  let tagsHtml = "";
  if (metadata.tags && metadata.tags.length > 0) {
    tagsHtml = `
    <div class="tags">
      <h3>Tags</h3>
      <div class="tag-list">
        ${metadata.tags
          .map(
            (tag) => `
          <span class="tag" style="background-color: ${tag.color || "#5865F2"}">
            ${tag.name}
          </span>
        `
          )
          .join("")}
      </div>
    </div>`;
  }

  // Different template styles
  const templates = {
    default: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Channel Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    header {
      text-align: center;
      margin-bottom: 20px;
    }
    h1 {
      color: #5865F2;
    }
    .metadata {
      background-color: #fff;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary {
      background-color: #fff;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary img {
      max-width: 100%;
      height: auto;
    }
    .tags {
      margin-top: 20px;
    }
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: bold;
    }
    footer {
      text-align: center;
      margin-top: 20px;
      font-size: 0.9rem;
      color: #666;
    }
  </style>
</head>
<body>
  <header>
    <h1>Discord Channel Summary</h1>
  </header>
  <div class="metadata">
    <p><strong>Channel ID:</strong> ${metadata.channelId}</p>
    <p><strong>Date Range:</strong> ${new Date(
      metadata.startDate
    ).toLocaleDateString()} to ${new Date(
      metadata.endDate
    ).toLocaleDateString()}</p>
    <p><strong>Messages Processed:</strong> ${metadata.messageCount}</p>
    ${tagsHtml}
  </div>
  <div class="summary">
    ${htmlContent}
  </div>
  <footer>
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </footer>
</body>
</html>`,

    compact: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 15px;
      background-color: #fff;
    }
    h1 {
      font-size: 18px;
      margin-bottom: 15px;
      color: #5865F2;
    }
    .metadata {
      font-size: 12px;
      color: #666;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      color: white;
      font-size: 10px;
      margin-right: 4px;
    }
    .summary {
      font-size: 14px;
    }
    .summary h2 {
      font-size: 16px;
    }
    .summary h3 {
      font-size: 15px;
    }
    footer {
      margin-top: 20px;
      font-size: 10px;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Discord Summary</h1>
  <div class="metadata">
    Channel: ${metadata.channelId} | 
    ${new Date(metadata.startDate).toLocaleDateString()} - ${new Date(
      metadata.endDate
    ).toLocaleDateString()} | 
    ${metadata.messageCount} messages
    <div style="margin-top: 10px;">
      ${metadata.tags
        .map(
          (tag) =>
            `<span class="tag" style="background-color: ${
              tag.color || "#5865F2"
            }">${tag.name}</span>`
        )
        .join("")}
    </div>
  </div>
  <div class="summary">
    ${htmlContent}
  </div>
  <footer>
    Generated on ${new Date().toLocaleDateString()}
  </footer>
</body>
</html>`,

    newsletter: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Newsletter</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 700px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f4f4f4;
    }
    .container {
      background-color: #fff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 3px 10px rgba(0,0,0,0.1);
    }
    header {
      background-color: #5865F2;
      color: white;
      padding: 20px;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 24px;
    }
    .metadata {
      background-color: #f9f9f9;
      padding: 15px 20px;
      font-size: 13px;
      color: #666;
      border-bottom: 1px solid #eee;
    }
    .content {
      padding: 25px;
    }
    .tag {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 50px;
      color: white;
      font-size: 11px;
      margin-right: 5px;
    }
    .summary h2 {
      color: #5865F2;
      border-bottom: 1px solid #eee;
      padding-bottom: 8px;
    }
    .summary a {
      color: #5865F2;
      text-decoration: none;
    }
    .summary a:hover {
      text-decoration: underline;
    }
    footer {
      text-align: center;
      padding: 15px 20px;
      background-color: #f9f9f9;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Discord Community Newsletter</h1>
    </header>
    <div class="metadata">
      <strong>Channel:</strong> ${metadata.channelId} | 
      <strong>Period:</strong> ${new Date(
        metadata.startDate
      ).toLocaleDateString()} - ${new Date(
      metadata.endDate
    ).toLocaleDateString()} | 
      <strong>Messages:</strong> ${metadata.messageCount}
      <div style="margin-top: 10px;">
        ${metadata.tags
          .map(
            (tag) =>
              `<span class="tag" style="background-color: ${
                tag.color || "#5865F2"
              }">${tag.name}</span>`
          )
          .join("")}
      </div>
    </div>
    <div class="content">
      <div class="summary">
        ${htmlContent}
      </div>
    </div>
    <footer>
      <p>This newsletter was automatically generated from Discord channel activity on ${new Date().toLocaleDateString()}</p>
    </footer>
  </div>
</body>
</html>`,
  };

  return templates[template] || templates.default;
}

module.exports = router;
