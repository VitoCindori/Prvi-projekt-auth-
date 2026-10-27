require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { auth } = require('express-openid-connect');


const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});

app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
}));

app.get('/', async (req, res) => {
    const total = await pool.query('SELECT COUNT(*) FROM passes');
  const active = await pool.query("SELECT COUNT(*) FROM passes WHERE status = 'ACTIVE'");
  res.render('index', { total: total.rows[0].count, 
                        active: active.rows[0].count,
                        loggedIn: req.oidc.isAuthenticated() });
});

app.get('/dbtest', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM passes');
    res.json(r.rows);
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/info/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const r = await pool.query('SELECT * FROM passes WHERE id = $1', [id]);
        res.json(r.rows[0]);
        if(r.rows.length === 0){
            res.status(404).send('Pass not found'); 
        }
    } catch (e){
        res.status(500).send(e.message);

    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.listen(port, () => {
  console.log(`Server radi na portu ${port}`);
});