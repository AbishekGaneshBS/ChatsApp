const express = require('express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const ejs = require('ejs');
const session = require('express-session');
const cookieParser = require('cookie-parser');


const auth_pb = require('./Services/auth_pb');
const auth_pb_grpc = require('./Services/auth_grpc_pb');
const common_pb = require('./Services/common_pb');
const user_pb = require('./Services/user_pb');
const user_pb_grpc = require('./Services/user_grpc_pb');
const group_pb = require('./Services/groups_pb');
const group_pb_grpc = require('./Services/groups_grpc_pb');

const app = express();
const PORT = 3000;


app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 
  } 
}));


const authClient = new auth_pb_grpc.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);

const userClient = new user_pb_grpc.UserChatServiceClient(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

const groupClient = new group_pb_grpc.GroupChatServiceClient(
  'localhost:50051',
  grpc.credentials.createInsecure()
);


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../Client/Views'));


app.use(express.static(path.join(__dirname, '../Client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const checkAuth = (req, res, next) => {
  if (req.session.user) {  
    req.isAuthenticated = true;
  } else {
    req.isAuthenticated = false;
  }
  next();
};
app.use(checkAuth);


function transformUserData(response) {
  console.log("gRPC response.getMyself():", response.getMyself().toObject());

  return {
    url: response.getUrl(),
    myself: {
      userId: response.getMyself().getId(),
      userName: response.getMyself().getUsername(),
      displayName: response.getMyself().getDisplayname()
    },
    contacts: response.getContactsList().map(contact => ({
      userId: contact.getId(),
      userName: contact.getUsername(),
      displayName: contact.getDisplayname()
    })),
    groups: response.getGroupsList().map(group => ({
      groupId: group.getGroupId(),
      groupName: group.getGroupName()
    }))
  };
}

// Routes
app.get('/', (req, res) => {
  if (req.isAuthenticated) return res.redirect('/main');
  
  const flash = req.session.flash;
  delete req.session.flash;
  
  res.render('index', {
    message: flash?.message || null,
    url: flash?.url || null,
    myself: flash?.myself || null,
    contacts: flash?.contacts || null,
    groups: flash?.groups || null,
    formToShow: flash?.formToShow || 'login'
  });
});

app.get('/main', (req, res) => {
  if (!req.isAuthenticated) {
    return res.redirect('/');
  }
  
  // Ensure user data exists in session
  if (!req.session.user) {
    return res.status(401).redirect('/logout');
  }

  res.render('main', { 
    user: req.session.user || {}, // Provide empty object as fallback
    contacts: req.session.contacts || [],
    groups: req.session.groups || [],
    url: req.session.url 
  });
});


// Authentication routes
app.post('/register', (req, res) => {
  const { username, displayName, password } = req.body;

  const request = new auth_pb.CreateAccountRequest();
  request.setUsername(username);
  request.setDisplayname(displayName);
  request.setPassword(password);

  authClient.createAccount(request, (err, response) => {
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
  request.setUsername(username);
  request.setPassword(password);

  authClient.loginAccount(request, (err, response) => {
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
      const userData = transformUserData(response);
      
      req.session.user = userData.myself;
      req.session.contacts = userData.contacts;
      req.session.groups = userData.groups;
      res.cookie('authToken', 'your-auth-token', { 
        maxAge: 24 * 60 * 60 * 1000, 
        httpOnly: true
      });

      return res.redirect('/main');
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

app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  req.session.destroy();
  res.redirect('/');
});

// Message API endpoints
app.get('/api/messages/user/:userId', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const request = new user_pb.LoadMessageRequest();
    
    const fromUser = new common_pb.MessageUser();
    fromUser.setUserid(parseInt(req.session.user.userId));
    fromUser.setUsername(req.session.user.userName);
    
    const toUser = new common_pb.MessageUser();
    toUser.setUserid(parseInt(req.params.userId));
    
    request.setFromuser(fromUser);
    request.setTouser(toUser);

    userClient.loadMessages(request, (err, response) => {
      if (err) {
        console.error('Error loading messages:', err);
        return res.status(500).json({ error: 'Failed to load messages' });
      }

      const messages = [];
      for (let i = 0; i < response.getSendersList().length; i++) {
        messages.push({
          sender: {
            userId: response.getSendersList()[i].getUserId(),
            userName: response.getSendersList()[i].getUserName()
          },
          receiver: {
            userId: response.getReceiversList()[i].getUserId(),
            userName: response.getReceiversList()[i].getUserName()
          },
          message: response.getMessagesList()[i],
          timestamp: response.getTimestampsList()[i],
          isGroup: false
        });
      }

      res.json({ messages });
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(400).json({ error: 'Invalid request parameters' });
  }
});

// Group messages endpoint
app.get('/api/messages/group/:groupId', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const request = new group_pb.LoadMessageRequest(); // Corrected message type
    
    const fromUser = new common_pb.MessageUser();
    fromUser.setUserId(parseInt(req.session.user.userId));
    fromUser.setUserName(req.session.user.userName);
    
    request.setFromuser(fromUser);
    request.setGroupid(parseInt(req.params.groupId));

    groupClient.loadMessages(request, (err, response) => { // Corrected method name
      if (err) {
        console.error('Error loading group messages:', err);
        return res.status(500).json({ error: 'Failed to load group messages' });
      }

      const messages = [];
      for (let i = 0; i < response.getSendersList().length; i++) {
        messages.push({
          sender: {
            userId: response.getSendersList()[i].getUserId(),
            userName: response.getSendersList()[i].getUserName()
          },
          groupId: req.params.groupId,
          message: response.getMessagesList()[i],
          timestamp: response.getTimestampsList()[i],
          isGroup: true
        });
      }

      res.json({ messages });
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(400).json({ error: 'Invalid request parameters' });
  }
});

// Send message endpoints
app.post('/api/messages/user/send', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  const { recipientId, message } = req.body;

  const request = new user_pb.SendMessageRequest();
  
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserId(req.session.user.userId);
  fromUser.setUserName(req.session.user.userName);
  
  const toUser = new common_pb.MessageUser();
  toUser.setUserId(parseInt(recipientId));
  
  request.setFromuser(fromUser);
  request.setTouser(toUser);
  request.setTextmessage(message);

  const stream = userClient.sendUserMessage();
  
  stream.on('data', (response) => {
    if (response.getResponse() === common_pb.MessageResponseStatus.MESSAGESUCCESS) {
      res.json({ success: true, timestamp: new Date().toISOString() });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
  
  stream.on('error', (err) => {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  });
  
  stream.write(request);
});

app.post('/api/messages/group/send', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  const { groupId, message } = req.body;

  const request = new group_pb.SendMessageRequest();
  
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserId(req.session.user.userId);
  fromUser.setUserName(req.session.user.userName);
  
  request.setFromuser(fromUser);
  request.setGroupid(parseInt(groupId));
  request.setTextmessage(message);

  const stream = groupClient.sendUserMessage();
  
  stream.on('data', (response) => {
    if (response.getResponse() === common_pb.MessageResponseStatus.MESSAGESUCCESS) {
      res.json({ success: true, timestamp: new Date().toISOString() });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  });
  
  stream.on('error', (err) => {
    console.error('Error sending group message:', err);
    res.status(500).json({ error: 'Failed to send group message' });
  });
  
  stream.write(request);
});

// Receive message streams
app.get('/api/messages/user/stream', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const request = new user_pb.ReceiveMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserId(req.session.user.userId);
  fromUser.setUserName(req.session.user.userName);
  request.setFromuser(fromUser);

  const stream = userClient.receiveUserMessage(request);
  
  stream.on('data', (response) => {
    const message = {
      senderId: response.getFromuser().getUserId(),
      senderName: response.getFromuser().getUserName(),
      message: response.getTextmessage(),
      timestamp: new Date().toISOString(),
      isGroup: false
    };
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  });
  
  stream.on('error', (err) => {
    console.error('Error in user message stream:', err);
    res.end();
  });
  
  req.on('close', () => {
    stream.cancel();
  });
});

app.get('/api/messages/group/stream', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const request = new group_pb.ReceiveMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserId(req.session.user.userId);
  fromUser.setUserName(req.session.user.userName);
  request.setFromuser(fromUser);

  const stream = groupClient.receiveUserMessage(request);
  
  stream.on('data', (response) => {
    const message = {
      senderId: response.getFromuser().getUserId(),
      senderName: response.getFromuser().getUserName(),
      groupId: response.getGroupid(),
      message: response.getTextmessage(),
      timestamp: new Date().toISOString(),
      isGroup: true
    };
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  });
  
  stream.on('error', (err) => {
    console.error('Error in group message stream:', err);
    res.end();
  });
  
  req.on('close', () => {
    stream.cancel();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});