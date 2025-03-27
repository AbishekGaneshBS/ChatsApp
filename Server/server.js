const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const ejs = require('ejs');

const auth_pb = require('./auth_pb');
const auth_pb_grpc = require('./auth_grpc_pb');
const common_pb = require('./common_pb');

const app = express();
const PORT = 3000;

const client = new auth_pb_grpc.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Client/Views'));

app.use(express.static(path.join(__dirname, '../Client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index', { 
    message: null, 
    url: null,
    myself: null,
    contacts: null
  }); 
});

app.post('/register', (req, res) => {
  const { username, displayName, password } = req.body;

  const request = new auth_pb.CreateAccountRequest();
  request.setUserName(username);
  request.setDisplayName(displayName);
  request.setPassword(password);

  client.createAccount(request, (err, response) => {
    if (err) {
      console.error('Error creating account:', err);
      return res.render('index', { 
        message: 'Error creating account. Please try again.', 
        url: null,
        myself: null,
        contacts: null
      });
    }

    const status = response.getStatus();
    if (status === common_pb.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      const myself = response.getMyself();
      const contacts = response.getContactsList();
      
      res.render('index', { 
        message: 'Registration successful!', 
        url,
        myself: myself ? {
          userId: myself.getUserId(),
          userName: myself.getUserName(),
          displayName: myself.getDisplayName()
        } : null,
        contacts: contacts.map(contact => ({
          userId: contact.getUserId(),
          userName: contact.getUserName(),
          displayName: contact.getDisplayName()
        }))
      });
    } else if (status === common_pb.ResponseStatus.ACCOUNT_EXISTS) {
      res.render('index', { 
        message: 'Username is already taken.', 
        url: null,
        myself: null,
        contacts: null
      });
    } else {
      res.render('index', { 
        message: 'Registration failed. Please try again.', 
        url: null,
        myself: null,
        contacts: null
      });
    }
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const request = new auth_pb.LoginAccountRequest();
  request.setUserName(username);
  request.setPassword(password);

  client.loginAccount(request, (err, response) => {
    if (err) {
      console.error('Error logging in:', err);
      return res.render('index', { 
        message: 'Error logging in. Please try again.', 
        url: null,
        myself: null,
        contacts: null
      });
    }

    const status = response.getStatus();
    if (status === common_pb.ResponseStatus.SUCCESS) {
      const url = response.getUrl();
      const myself = response.getMyself();
      const contacts = response.getContactsList();
      
      res.render('index', { 
        message: 'Login successful!', 
        url,
        myself: myself ? {
          userId: myself.getUserId(),
          userName: myself.getUserName(),
          displayName: myself.getDisplayName()
        } : null,
        contacts: contacts.map(contact => ({
          userId: contact.getUserId(),
          userName: contact.getUserName(),
          displayName: contact.getDisplayName()
        }))
      });
    } else if (status === common_pb.ResponseStatus.ACCOUNT_NOT_FOUND) {
      res.render('index', { 
        message: 'Account not found.', 
        url: null,
        myself: null,
        contacts: null
      });
    } else if (status === common_pb.ResponseStatus.UNAUTHORIZED) {
      res.render('index', { 
        message: 'Wrong username or password.', 
        url: null,
        myself: null,
        contacts: null
      });
    } else {
      res.render('index', { 
        message: 'Login failed. Please try again.', 
        url: null,
        myself: null,
        contacts: null
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});