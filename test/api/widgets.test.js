const test = require('tape')
const supertest = require('supertest')
const mongoose = require('../../lib/mongo')
const config = require('../../config')
const server = require('../../server')

// Test data
const testWidget = {
  name: 'Test Widget',
  quantity: 10,
  metadata: {
    category: 'test',
    description: 'A test widget'
  },
  variations: [
    {
      name: 'Red',
      price: 9.99,
      color: '#FF0000'
    }
  ]
}

test('widgets API - create widget', async (t) => {
  const res = await supertest(server)
    .post('/widgets')
    .set('Authorization', 'Bearer test-token')
    .send(testWidget)
    .expect(201)
  
  t.ok(res.body._id)
  t.equal(res.body.name, testWidget.name)
  t.equal(res.body.quantity, testWidget.quantity)
  t.ok(res.body.dateCreated)
  t.ok(res.body.dateUpdated)
  t.end()
})

test('widgets API - list widgets', async (t) => {
  const res = await supertest(server)
    .get('/widgets')
    .set('Authorization', 'Bearer test-token')
    .expect(200)
  
  t.ok(Array.isArray(res.body))
  t.ok(res.body.length > 0)
  t.ok(res.body[0]._id)
  t.ok(res.body[0].name)
  t.end()
})

test('widgets API - get widget by id', async (t) => {
  // First create a widget
  const createRes = await supertest(server)
    .post('/widgets')
    .set('Authorization', 'Bearer test-token')
    .send(testWidget)
    .expect(201)
  
  const widgetId = createRes.body._id
  
  // Then get it
  const res = await supertest(server)
    .get(`/widgets/${widgetId}`)
    .set('Authorization', 'Bearer test-token')
    .expect(200)
  
  t.equal(res.body._id, widgetId)
  t.equal(res.body.name, testWidget.name)
  t.end()
})

test('widgets API - update widget', async (t) => {
  // First create a widget
  const createRes = await supertest(server)
    .post('/widgets')
    .set('Authorization', 'Bearer test-token')
    .send(testWidget)
    .expect(201)
  
  const widgetId = createRes.body._id
  const updateData = { ...testWidget, name: 'Updated Widget' }
  
  // Then update it
  const res = await supertest(server)
    .put(`/widgets/${widgetId}`)
    .set('Authorization', 'Bearer test-token')
    .send(updateData)
    .expect(200)
  
  t.equal(res.body._id, widgetId)
  t.equal(res.body.name, 'Updated Widget')
  t.ok(res.body.dateUpdated > res.body.dateCreated)
  t.end()
})

test('widgets API - delete widget', async (t) => {
  // First create a widget
  const createRes = await supertest(server)
    .post('/widgets')
    .set('Authorization', 'Bearer test-token')
    .send(testWidget)
    .expect(201)
  
  const widgetId = createRes.body._id
  
  // Then delete it
  await supertest(server)
    .delete(`/widgets/${widgetId}`)
    .set('Authorization', 'Bearer test-token')
    .expect(204)
  
  // Verify it's gone
  await supertest(server)
    .get(`/widgets/${widgetId}`)
    .set('Authorization', 'Bearer test-token')
    .expect(404)
  
  t.end()
})

test('widgets API - validation errors', async (t) => {
  const invalidWidget = {
    name: 'Test Widget',
    quantity: -1, // Invalid quantity
    metadata: {
      category: 'test'
    }
  }
  
  const res = await supertest(server)
    .post('/widgets')
    .set('Authorization', 'Bearer test-token')
    .send(invalidWidget)
    .expect(400)
  
  t.ok(res.body.error.includes('quantity'))
  t.end()
}) 