const express = require("express");
const autoCatch = require("../lib/auto-catch");
const Tag = require("../models/tag");

const router = express.Router();

// Get all tags
router.get(
  "/",
  autoCatch(async (req, res) => {
    const tags = await Tag.find().sort({ name: 1 });
    res.json(tags);
  })
);

// Get a single tag by ID
router.get(
  "/:id",
  autoCatch(async (req, res) => {
    const tag = await Tag.findById(req.params.id);
    if (!tag) {
      return res.status(404).json({ error: "Tag not found" });
    }
    res.json(tag);
  })
);

// Create a new tag
router.post(
  "/",
  autoCatch(async (req, res) => {
    const { name, color, description } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: "Tag name is required" });
    }

    // Check if tag already exists
    const existingTag = await Tag.findOne({ name: name.toLowerCase() });
    if (existingTag) {
      return res
        .status(409)
        .json({ error: "Tag with this name already exists" });
    }

    // Create new tag
    const newTag = new Tag({
      name,
      color,
      description,
    });

    const savedTag = await newTag.save();
    res.status(201).json(savedTag);
  })
);

// Update a tag
router.put(
  "/:id",
  autoCatch(async (req, res) => {
    const { name, color, description } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (color) updates.color = color;
    if (description) updates.description = description;

    const updatedTag = await Tag.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedTag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json(updatedTag);
  })
);

// Delete a tag
router.delete(
  "/:id",
  autoCatch(async (req, res) => {
    const deletedTag = await Tag.findByIdAndDelete(req.params.id);
    if (!deletedTag) {
      return res.status(404).json({ error: "Tag not found" });
    }

    res.json({ message: "Tag deleted successfully" });
  })
);

module.exports = router;
