require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { auth, requiresAuth } = require('express-openid-connect');
const { auth: jwtAuth, requiredScopes } = require('express-oauth2-jwt-bearer');
const QRCode = require('qrcode');


const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false
});


app.use(express.json());
app.set('view engine', 'ejs');
app.set('trust proxy', 1);
console.log('ISSUER:', process.env.ISSUER_BASE_URL, 'AUDIENCE:', process.env.AUDIENCE);
const checkJwt = jwtAuth({
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  audience: process.env.AUDIENCE,
});

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SESSION_SECRET,
  baseURL: process.env.BASE_URL,
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
}));

app.get('/', async (req, res) => {
    const total = await pool.query('SELECT COUNT(*) FROM passes');
  const active = await pool.query("SELECT COUNT(*) FROM passes WHERE status = 'ACTIVE'");
  const loggedIn = req.oidc.isAuthenticated();
  const passes = loggedIn? (await pool.query('SELECT * FROM passes ORDER BY issued_at DESC')).rows : [];
  res.render('index', { total: total.rows[0].count, 
                        active: active.rows[0].count,
                        loggedIn: req.oidc.isAuthenticated(),
                        passes: passes });
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
        if(r.rows.length === 0){
            return res.status(404).send('Pass not found'); 
        }
        res.render('info', { pass: r.rows[0] });
    } catch (e){
        return res.status(404).send('Propusnica ne postoji');

    }
});

app.get('/passes/:id', checkJwt, requiredScopes('read:passes'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM passes WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.sendStatus(404);
    const p = r.rows[0];
    res.json({
      id: p.id,
      name: p.name,
      document: p.document,
      issuedAt: p.issued_at,
      status: p.status,
    });
  } catch (e) {
    res.sendStatus(404); 
  }
});
/*
app.get('/login', (req, res) => {
    res.render('login');
});*/



app.post('/passes', checkJwt, requiredScopes('create:passes'), async (req, res) => {
  const { name, document } = req.body || {};
  if (!name || !document || !String(name).trim() || !String(document).trim()) {
    return res.sendStatus(400);
  }
  const r = await pool.query(
    'INSERT INTO passes (name, document) VALUES ($1, $2) RETURNING id',
    [name.trim(), document.trim()]
  );
  const id = r.rows[0].id;

  const png = await QRCode.toBuffer(`${process.env.BASE_URL}/info/${id}`);
  res.status(201)
    .set('Content-Type', 'image/png')
    .set('Location', `${process.env.BASE_URL}/passes/${id}`)
    .send(png);
});

app.post('/manage/:id/cancel', requiresAuth(), async (req, res) => {
  await pool.query("UPDATE passes SET status = 'CANCELLED' WHERE id = $1", [req.params.id]);
  res.redirect('/');
});

app.post('/manage/:id/delete', requiresAuth(), async (req, res) => {
  await pool.query('DELETE FROM passes WHERE id = $1', [req.params.id]);
  res.redirect('/');
});

app.listen(port, () => {
  console.log(`Server radi na portu ${port}`);
});