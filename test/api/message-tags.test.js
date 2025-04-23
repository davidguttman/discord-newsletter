const test = require("tape");
const supertest = require("supertest");
const app = require("../../server");
const db = require("../helpers/db");
const Message = require("../../models/message");
const Tag = require("../../models/tag");
const mongoose = require("mongoose");

// Sample message data
const sampleMessages = [
  {
    id: "1234567890",
    content: "This is a test message",
    authorId: "123456",
    authorUsername: "testUser",
    channelId: "789012",
    channelName: "test-channel",
    guildId: "345678",
    guildName: "Test Guild",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "0987654321",
    content: "This is another test message",
    authorId: "123456",
    authorUsername: "testUser",
    channelId: "789012",
    channelName: "test-channel",
    guildId: "345678",
    guildName: "Test Guild",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Sample tag data
const sampleTags = [
  {
    name: "announcement",
    color: "#FF5733",
    description: "Important announcements",
  },
  {
    name: "question",
    color: "#3498DB",
    description: "Questions from users",
  },
];

test("Setup", async (t) => {
  await db.setupTestDb();

  // Add sample messages and tags
  await Message.insertMany(sampleMessages);

  const createdTags = await Tag.insertMany(sampleTags);
  t.equal(createdTags.length, 2, "Should create 2 tags");

  t.end();
});

test("POST /message-tags/:messageId/tags/:tagId - should add tag to message", async (t) => {
  // Get a tag ID
  const tags = await Tag.find();
  const tagId = tags[0]._id.toString();

  const res = await supertest(app)
    .post(`/message-tags/1234567890/tags/${tagId}`)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.ok(res.body.tags, "Response should include tags array");
  t.equal(res.body.tags.length, 1, "Message should have 1 tag");
  t.equal(res.body.tags[0].toString(), tagId, "Tag ID should match");
  t.end();
});

test("POST /message-tags/:messageId/tags/:tagId - should return 409 if tag already exists on message", async (t) => {
  // Get a tag ID
  const tags = await Tag.find();
  const tagId = tags[0]._id.toString();

  const res = await supertest(app)
    .post(`/message-tags/1234567890/tags/${tagId}`)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(409);

  t.equal(
    res.body.error,
    "Message already has this tag",
    "Should return appropriate error message"
  );
  t.end();
});

test("GET /message-tags/:messageId/tags - should get all tags for a message", async (t) => {
  const res = await supertest(app)
    .get("/message-tags/1234567890/tags")
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.length, 1, "Should return 1 tag");
  t.equal(res.body[0].name, "announcement", "Tag name should match");
  t.end();
});

test("DELETE /message-tags/:messageId/tags/:tagId - should remove tag from message", async (t) => {
  // Get a tag ID
  const tags = await Tag.find();
  const tagId = tags[0]._id.toString();

  const res = await supertest(app)
    .delete(`/message-tags/1234567890/tags/${tagId}`)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.tags.length, 0, "Message should have no tags after removal");
  t.end();
});

test("POST /message-tags/bulk-tag - should add tag to multiple messages", async (t) => {
  // Get a tag ID
  const tags = await Tag.find();
  const tagId = tags[1]._id.toString();

  const res = await supertest(app)
    .post("/message-tags/bulk-tag")
    .send({
      messageIds: ["1234567890", "0987654321"],
      tagId,
    })
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.matched, 2, "Should match 2 messages");
  t.equal(res.body.modified, 2, "Should modify 2 messages");

  // Verify both messages were tagged
  const message1 = await Message.findOne({ id: "1234567890" });
  const message2 = await Message.findOne({ id: "0987654321" });

  t.equal(message1.tags.length, 1, "First message should have 1 tag");
  t.equal(message2.tags.length, 1, "Second message should have 1 tag");
  t.equal(message1.tags[0].toString(), tagId, "Tag ID should match");
  t.equal(message2.tags[0].toString(), tagId, "Tag ID should match");
  t.end();
});

test("GET /summarize/channel/:channelId - should filter by tag", async (t) => {
  // Get a tag ID
  const tags = await Tag.find();
  const tagId = tags[1]._id.toString();

  // Set date range that includes our test messages
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1);

  // Mock the OpenAI API call
  const originalOpenAI = require("../../lib/openai");
  require("../../lib/openai").summarizeMessages = async () => ({
    summary: "This is a test summary",
    usage: { total_tokens: 100 },
  });

  // Call the API with tag filtering
  const res = await supertest(app)
    .get(
      `/summarize/channel/789012?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&tags=${tagId}`
    )
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.messageCount, 2, "Should include 2 messages in the summary");
  t.equal(
    res.body.tagFilters[0],
    tagId,
    "Tag filter should be included in response"
  );
  t.equal(
    res.body.summary,
    "This is a test summary",
    "Summary should be returned"
  );

  // Restore the original OpenAI function
  require("../../lib/openai").summarizeMessages =
    originalOpenAI.summarizeMessages;
  t.end();
});

test("Cleanup", async (t) => {
  await db.teardownTestDb();
  t.end();
});

test.onFinish(() => {
  process.exit(0);
});
