const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const routes = require('./routes');

const app = express();

/* MIDDLEWARE */
app.use(express.json()); // Parse JSON request bodies (for AJAX/fetch requests)
app.use(bodyParser.urlencoded({ extended: false })); // Parse form data
app.use(express.static('public'));

app.use(session({
  secret: 'laporan-investigasi-secret',
  resave: false,
  saveUninitialized: false
}));

/* VIEW ENGINE */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ROUTER */
app.use('/', routes);

/* SERVER */
app.listen(3000, () => {
  console.log('Server running http://localhost:3000');
});
