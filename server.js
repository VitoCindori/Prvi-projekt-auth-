require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');


const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/dbtest', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM passes');
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.listen(port, () => {
  console.log(`Server radi na portu ${port}`);
});