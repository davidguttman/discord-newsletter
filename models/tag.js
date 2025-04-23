const mongoose = require("mongoose");

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  color: {
    type: String,
    default: "#5865F2", // Discord blue as default
    match: [
      /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      "Please provide a valid hex color",
    ],
  },
  description: {
    type: String,
    maxlength: 200,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field on save
tagSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create a compound index on name (for uniqueness)
tagSchema.index({ name: 1 });

const Tag = mongoose.model("Tag", tagSchema);

module.exports = Tag;
