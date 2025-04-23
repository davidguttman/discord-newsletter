const test = require("tape");
const supertest = require("supertest");
const app = require("../../server");
const db = require("../helpers/db");
const Tag = require("../../models/tag");

test("Setup", async (t) => {
  await db.setupTestDb();
  t.end();
});

test("GET /tags - should return empty array when no tags exist", async (t) => {
  const res = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.length, 0, "Response body should be an empty array");
  t.end();
});

test("POST /tags - should create a new tag", async (t) => {
  const tagData = {
    name: "announcement",
    color: "#FF5733",
    description: "Important announcements from team members",
  };

  const res = await supertest(app)
    .post("/tags")
    .send(tagData)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(201);

  t.equal(res.body.name, "announcement", "Tag name should match");
  t.equal(res.body.color, "#FF5733", "Tag color should match");
  t.equal(
    res.body.description,
    "Important announcements from team members",
    "Tag description should match"
  );
  t.ok(res.body._id, "Tag should have an ID");
  t.end();
});

test("POST /tags - should convert tag name to lowercase", async (t) => {
  const tagData = {
    name: "QUESTION",
    color: "#3498DB",
    description: "Questions from users",
  };

  const res = await supertest(app)
    .post("/tags")
    .send(tagData)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(201);

  t.equal(res.body.name, "question", "Tag name should be lowercase");
  t.end();
});

test("POST /tags - should return error for duplicate tag name", async (t) => {
  const tagData = {
    name: "announcement",
    color: "#FF5733",
    description: "Duplicate tag name",
  };

  const res = await supertest(app)
    .post("/tags")
    .send(tagData)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(409);

  t.equal(
    res.body.error,
    "Tag with this name already exists",
    "Should return duplicate error message"
  );
  t.end();
});

test("GET /tags - should return all tags", async (t) => {
  const res = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.length, 2, "Should return 2 tags");
  t.equal(res.body[0].name, "announcement", "First tag should be announcement");
  t.equal(res.body[1].name, "question", "Second tag should be question");
  t.end();
});

test("GET /tags/:id - should return a specific tag", async (t) => {
  // Get tag ID from the list
  const listRes = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect(200);

  const tagId = listRes.body[0]._id;

  const res = await supertest(app)
    .get(`/tags/${tagId}`)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.name, "announcement", "Should return the correct tag");
  t.equal(res.body._id, tagId, "Tag ID should match");
  t.end();
});

test("PUT /tags/:id - should update a tag", async (t) => {
  // Get tag ID from the list
  const listRes = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect(200);

  const tagId = listRes.body[0]._id;

  const updateData = {
    color: "#E74C3C",
    description: "Updated description for announcements",
  };

  const res = await supertest(app)
    .put(`/tags/${tagId}`)
    .send(updateData)
    .set("Accept", "application/json")
    .expect("Content-Type", /json/)
    .expect(200);

  t.equal(res.body.name, "announcement", "Tag name should remain unchanged");
  t.equal(res.body.color, "#E74C3C", "Tag color should be updated");
  t.equal(
    res.body.description,
    "Updated description for announcements",
    "Tag description should be updated"
  );
  t.end();
});

test("DELETE /tags/:id - should delete a tag", async (t) => {
  // Get tag ID from the list
  const listRes = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect(200);

  const tagId = listRes.body[0]._id;

  await supertest(app).delete(`/tags/${tagId}`).expect(200);

  // Verify tag was deleted
  const verifyRes = await supertest(app)
    .get("/tags")
    .set("Accept", "application/json")
    .expect(200);

  t.equal(verifyRes.body.length, 1, "Should be only 1 tag left");
  t.equal(
    verifyRes.body[0].name,
    "question",
    "Remaining tag should be question"
  );
  t.end();
});

test("Cleanup", async (t) => {
  await db.teardownTestDb();
  t.end();
});

test.onFinish(() => {
  process.exit(0);
});
