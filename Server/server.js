const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const createorloginProto = require('./createorlogin_grpc_pb');
const messages = require('./createorlogin_pb');
const ejs = require('ejs');

const app = express();
const PORT = 3000;


const client = new createorloginProto.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Client/Views'));


app.use(express.static(path.join(__dirname, '../Client')));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  res.render('index', { message: null, url: null }); 
});


app.post('/register', (req, res) => {
  const { username, displayName, password } = req.body;

  const request = new messages.CreateAccountRequest();
  request.setUserName(username);
  request.setDisplayName(displayName);
  request.setPassword(password);

  client.createAccount(request, (err, response) => {
    if (err) {
      console.error('Error creating account:', err);
      res.render('index', { message: 'Error creating account. Please try again.', url: null }); 
      return;
    }

    const status = response.getStatus();
    if (status === messages.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      res.render('index', { message: 'Registration successful!', url });
    } else if (status === messages.ResponseStatus.ACCOUNT_EXISTS) {
      res.render('index', { message: 'Username is already taken.', url: null }); 
    } else {
      res.render('index', { message: 'Registration failed. Please try again.', url: null }); 
    }
  });
});


app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const request = new messages.LoginAccountRequest();
  request.setUserName(username);
  request.setPassword(password);

  client.loginAccount(request, (err, response) => {
    if (err) {
      console.error('Error logging in:', err);
      res.render('index', { message: 'Error logging in. Please try again.', url: null }); 
      return;
    }

    const status = response.getStatus();
    if (status === messages.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      res.render('index', { message: 'Login successful!', url });
    } else if (status === messages.ResponseStatus.ACCOUNT_NOT_FOUND) {
      res.render('index', { message: 'Account not found.', url: null }); 
    } else if (status === messages.ResponseStatus.UNAUTHORIZED) {
      res.render('index', { message: 'Wrong username or password.', url: null }); 
    } else {
      res.render('index', { message: 'Login failed. Please try again.', url: null }); 
    }
  });
});


app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});