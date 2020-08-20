const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this protected route, we get the user's id like so: ${req.userId}`
  });
});

app.get('/api/todos', async (req, res) => {
  const data = await client.query(`SELECT todos.id, name, completed 
  FROM todos
  WHERE todos.owner_id = ${req.userId}`);

  res.json(data.rows);
});

app.get('/users', async (req, res) => {
  const data = await client.query(`SELECT *
  FROM users`);

  res.json(data.rows);
});

app.put('/api/todos/:id', async (req, res) => {
  const todosId = req.params.id;

  try {
    const updateTodos = {
      name: req.body.name,
      completed: req.body.completed,
      owner_id: req.body.owner_id
    };

    const data = await client.query(`
      UPDATE todos
      SET name=$1, completed=$2, owner_id=$3
      WHERE todos.id = $4
      RETURNING * `, [updateTodos.name, updateTodos.completed, todosId, req.userId]);

    res.json(data.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/todos', async (req, res) => {
  try {
    const newTodos = {
      name: req.body.name,
      completed: req.body.completed,
      owner_id: req.body.owner_id
    };

    const data = await client.query(`
      INSERT INTO todos(name, completed, owner_id)
      VALUES ($1, $2, $3)
      RETURNING * `, [newTodos.name, newTodos.completed, req.userId]);

    res.json(data.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  const todoId = req.params.id;

  const data = await client.query(`
      DELETE FROM todos
        WHERE todos.id=$1 AND todos.owner_id=$2
        `, [todoId, req.userId]);

  res.json(data.rows[0]);
});

app.use(require('./middleware/error'));

module.exports = app;
