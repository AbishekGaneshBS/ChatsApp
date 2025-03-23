const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const createorloginProto = require('./createorlogin_grpc_pb');
const messages = require('./createorlogin_pb');

const app = express();
const PORT = 3000;


const client = new createorloginProto.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);


app.use(express.static(path.join(__dirname, '../Client/Template')));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/Template', 'index.html'));
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
      res.status(500).json({ status: 'FAILURE', message: 'Error creating account. Please try again.' });
      return;
    }

    const status = response.getStatus();
    if (status === messages.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      res.json({ status: 'SUCCESS', message: 'Registration successful!', url });
    } else if (status === messages.ResponseStatus.ACCOUNT_EXISTS) {
      res.status(400).json({ status: 'FAILURE', message: 'Username is already taken.' });
    } else {
      res.status(400).json({ status: 'FAILURE', message: 'Registration failed. Please try again.' });
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
      res.status(500).json({ status: 'FAILURE', message: 'Error logging in. Please try again.' });
      return;
    }

    const status = response.getStatus();
    if (status === messages.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      res.json({ status: 'SUCCESS', message: 'Login successful!', url });
    } else if (status === messages.ResponseStatus.ACCOUNT_NOT_FOUND) {
      res.status(400).json({ status: 'FAILURE', message: 'Account not found.' });
    } else if (status === messages.ResponseStatus.UNAUTHORIZED) {
      res.status(400).json({ status: 'FAILURE', message: 'Wrong username or password.' });
    } else {
      res.status(400).json({ status: 'FAILURE', message: 'Login failed. Please try again.' });
    }
  });
});


app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});