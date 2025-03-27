const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const ejs = require('ejs');
const session = require('express-session');

const auth_pb = require('./auth_pb');
const auth_pb_grpc = require('./auth_grpc_pb');
const common_pb = require('./common_pb');

const app = express();
const PORT = 3000;


app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

const client = new auth_pb_grpc.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Client/Views'));

app.use(express.static(path.join(__dirname, '../Client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


function transformUserData(response) {
  return {
    url: response.getUrl(),
    myself: {
      userId: response.getMyself().getUserId(),
      userName: response.getMyself().getUserName(),
      displayName: response.getMyself().getDisplayName()
    },
    contacts: response.getContactsList().map(contact => ({
      userId: contact.getUserId(),
      userName: contact.getUserName(),
      displayName: contact.getDisplayName()
    }))
  };
}


app.get('/', (req, res) => {
  const flash = req.session.flash;
  delete req.session.flash; 
  
  res.render('index', {
    message: flash?.message || null,
    url: flash?.url || null,
    myself: flash?.myself || null,
    contacts: flash?.contacts || null,
    formToShow: flash?.formToShow || 'login' 
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
      req.session.flash = {
        message: 'Error creating account. Please try again.',
        formToShow: 'register'
      };
      return res.redirect('/');
    }

    const status = response.getStatus();
    if (status === common_pb.ResponseStatus.SUCCESS) {
      req.session.flash = {
        message: 'Registration successful!',
        ...transformUserData(response),
        formToShow: 'login'
      };
    } else if (status === common_pb.ResponseStatus.ACCOUNT_EXISTS) {
      req.session.flash = {
        message: 'Username is already taken.',
        formToShow: 'register'
      };
    } else {
      req.session.flash = {
        message: 'Registration failed. Please try again.',
        formToShow: 'register'
      };
    }
    res.redirect('/');
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
      req.session.flash = {
        message: 'Error logging in. Please try again.',
        formToShow: 'login'
      };
      return res.redirect('/');
    }

    const status = response.getStatus();
    if (status === common_pb.ResponseStatus.SUCCESS) {
      req.session.flash = {
        message: 'Login successful!',
        ...transformUserData(response)
      };

      return res.redirect(response.getUrl());
    } else if (status === common_pb.ResponseStatus.ACCOUNT_NOT_FOUND) {
      req.session.flash = {
        message: 'Account not found.',
        formToShow: 'login'
      };
    } else if (status === common_pb.ResponseStatus.UNAUTHORIZED) {
      req.session.flash = {
        message: 'Wrong username or password.',
        formToShow: 'login'
      };
    } else {
      req.session.flash = {
        message: 'Login failed. Please try again.',
        formToShow: 'login'
      };
    }
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`Express server is running on http://localhost:${PORT}`);
});