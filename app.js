const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const db = require('./config/db');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const routes = require('./routes');

const app = express();

/* MIDDLEWARE */
app.use(express.json()); // Parse JSON request bodies (for AJAX/fetch requests)
app.use(bodyParser.urlencoded({ extended: false })); // Parse form data
app.use(cookieParser());
app.use(express.static('public'));

app.use(session({
  secret: 'projek-bri',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(flash());

/* GLOBAL LOCALS */
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  
  // Check JWT Token
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, 'secret_key_anda'); // Gunakan secret key yang sama
      req.user = decoded;
      res.locals.user = decoded;
    } catch (err) {
      req.user = null;
      res.locals.user = null;
    }
  } else {
    req.user = null;
    res.locals.user = null;
  }
  
  next();
});

/* REQUEST LOGGING */
app.use((req, res, next) => {
  if (req.path === '/auto-logout' || req.path === '/heartbeat') {
    console.log(`📍 ${req.method} ${req.path}`, {
      sessionUser: req.user?.username || 'no-session',
      timestamp: new Date().toLocaleTimeString('id-ID')
    });
  }
  next();
});

/* VIEW ENGINE */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ROUTER */
app.use('/', routes);

app.use((req, res, next) => {
  if (req.user) {
    db.query(
      'UPDATE users SET last_activity=NOW() WHERE id=?',
      [req.user.id]
    );
  }
  next();
});


/* SERVER */
app.listen(3000, () => {
  console.log('Server running http://localhost:3000');
});
