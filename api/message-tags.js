const express = require("express");
const autoCatch = require("../lib/auto-catch");
const Message = require("../models/message");
const Tag = require("../models/tag");
const mongoose = require("mongoose");

const router = express.Router();

// Add tag to a message
router.post(
  "/:messageId/tags/:tagId",
  autoCatch(async (req, res) => {
    const { messageId, tagId } = req.params;

    // Validate tagId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: "Invalid tag ID format" });
    }

    // Check if tag exists
    const tag = await Tag.findById(tagId);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Update message with new tag if it doesn't already have it
    const updatedMessage = await Message.findOneAndUpdate(
      { id: messageId, tags: { $ne: tagId } },
      { $addToSet: { tags: tagId } },
      { new: true }
    );

    if (!updatedMessage) {
      const message = await Message.findOne({ id: messageId });
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      // Message exists but already has the tag
      return res.status(409).json({ error: "Message already has this tag" });
    }

    res.json(updatedMessage);
  })
);

// Remove tag from a message
router.delete(
  "/:messageId/tags/:tagId",
  autoCatch(async (req, res) => {
    const { messageId, tagId } = req.params;

    // Validate tagId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: "Invalid tag ID format" });
    }

    const updatedMessage = await Message.findOneAndUpdate(
      { id: messageId },
      { $pull: { tags: tagId } },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(updatedMessage);
  })
);

// Get all tags for a message
router.get(
  "/:messageId/tags",
  autoCatch(async (req, res) => {
    const { messageId } = req.params;

    const message = await Message.findOne({ id: messageId }).populate("tags");
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(message.tags || []);
  })
);

// Bulk tag multiple messages
router.post(
  "/bulk-tag",
  autoCatch(async (req, res) => {
    const { messageIds, tagId } = req.body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "Message IDs array is required" });
    }

    if (!tagId || !mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ error: "Valid tag ID is required" });
    }

    // Check if tag exists
    const tag = await Tag.findById(tagId);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    // Add tag to all specified messages
    const result = await Message.updateMany(
      { id: { $in: messageIds } },
      { $addToSet: { tags: tagId } }
    );

    res.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
    });
  })
);

module.exports = router;
