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
  req.isAuthenticated = !!req.session.user;
  next();
};
app.use(checkAuth);

function transformUserData(response) {
  return {
    url: response.getUrl(),
    myself: {
      userId: response.getMyself().getUserid(),
      userName: response.getMyself().getUsername(),
      displayName: response.getMyself().getDisplayname()
    },
    contacts: response.getContactsList().map(contact => ({
      userId: contact.getUserid(),
      userName: contact.getUsername(),
      displayName: contact.getDisplayname()
    })),
    groups: response.getGroupsList().map(group => ({
      groupId: group.getGroupuserid(),
      groupName: group.getGroupName()
    }))
  };
}

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
  if (!req.isAuthenticated) return res.redirect('/');
  if (!req.session.user) return res.status(401).redirect('/logout');
  res.render('main', { 
    user: req.session.user || {},
    contacts: req.session.contacts || [],
    groups: req.session.groups || [],
    url: req.session.url 
  });
});

app.post('/register', (req, res) => {
  const request = new auth_pb.CreateAccountRequest();
  request.setUsername(req.body.username);
  request.setDisplayname(req.body.displayName);
  request.setPassword(req.body.password);

  authClient.createAccount(request, (err, response) => {
    if (err) {
      req.session.flash = { message: 'Error creating account', formToShow: 'register' };
      return res.redirect('/');
    }
    if (response.getStatus() === common_pb.ResponseStatus.SUCCESS) {
      req.session.flash = { message: 'Registration successful', formToShow: 'login' };
    } else {
      req.session.flash = { message: 'Registration failed', formToShow: 'register' };
    }
    res.redirect('/');
  });
});

app.post('/login', (req, res) => {
  const request = new auth_pb.LoginAccountRequest();
  request.setUsername(req.body.username);
  request.setPassword(req.body.password);

  authClient.loginAccount(request, (err, response) => {
    if (err) {
      req.session.flash = { message: 'Login error', formToShow: 'login' };
      return res.redirect('/');
    }
    if (response.getStatus() === common_pb.ResponseStatus.SUCCESS) {
      const userData = transformUserData(response);
      req.session.user = userData.myself;
      req.session.contacts = userData.contacts;
      req.session.groups = userData.groups;
      res.cookie('authToken', 'token', { maxAge: 86400000, httpOnly: true });
      return res.redirect('/main');
    }
    req.session.flash = { message: 'Login failed', formToShow: 'login' };
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  res.clearCookie('authToken');
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/messages/user/:userId', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
  const toUserId = parseInt(req.params.userId);
  if (isNaN(toUserId)) return res.status(400).json({ error: 'Invalid ID' });

  const request = new user_pb.LoadMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(parseInt(req.session.user.userId));
  fromUser.setUsername(req.session.user.userName);
  const toUser = new common_pb.MessageUser();
  toUser.setUserid(toUserId);
  request.setFromuser(fromUser);
  request.setTouser(toUser);

  userClient.loadMessages(request, (err, response) => {
    if (err) return res.status(500).json({ error: 'Internal error' });
    const messages = response.getSendersList().map((sender, index) => ({
      sender: { userId: sender.getUserid(), username: sender.getUsername() },
      receiver: { userId: response.getReceiversList()[index].getUserid() },
      message: response.getMessagesList()[index],
      timestamp: response.getTimestampsList()[index],
      isGroup: false
    }));
    res.json({ messages });
  });
});

app.get('/api/messages/group/:groupId', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
  const groupId = parseInt(req.params.groupId);
  if (isNaN(groupId)) return res.status(400).json({ error: 'Invalid ID' });

  const request = new group_pb.LoadMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(parseInt(req.session.user.userId));
  fromUser.setUsername(req.session.user.userName);
  request.setFromuser(fromUser);
  request.setGroupid(groupId);

  groupClient.loadMessages(request, (err, response) => {
    if (err) return res.status(500).json({ error: 'Internal error' });
    const messages = response.getSendersList().map((sender, index) => ({
      sender: { userId: sender.getUserid(), username: sender.getUsername() },
      groupId,
      message: response.getMessagesList()[index],
      timestamp: response.getTimestampsList()[index],
      isGroup: true
    }));
    res.json({ messages });
  });
});

app.post('/api/messages/user/send', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  const request = new user_pb.SendMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(req.session.user.userId);
  fromUser.setUsername(req.session.user.userName);
  const toUser = new common_pb.MessageUser();
  toUser.setUserid(parseInt(req.body.recipientId));
  request.setSender(fromUser);
  request.setReceiver(toUser);
  request.setMessage(req.body.message);

  const stream = userClient.sendMessages();
  stream.on('data', () => res.json({ success: true }));
  stream.on('error', () => res.status(500).json({ error: 'Send failed' }));
  stream.write(request);
});

app.post('/api/messages/group/send', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });

  const request = new group_pb.SendMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(req.session.user.userId);
  fromUser.setUsername(req.session.user.userName);
  request.setFromuser(fromUser);
  request.setGroupid(parseInt(req.body.groupId));
  request.setTextmessage(req.body.message);

  const stream = groupClient.sendUserMessage();
  stream.on('data', () => res.json({ success: true }));
  stream.on('error', () => res.status(500).json({ error: 'Send failed' }));
  stream.write(request);
});

app.get('/api/messages/user/stream', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const request = new user_pb.ReceiveMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(parseInt(req.session.user.userId));
  fromUser.setUsername(req.session.user.userName);
  request.setFromuser(fromUser);

  const stream = userClient.receiveUserMessage(request);
  stream.on('data', (response) => {
    res.write(`data: ${JSON.stringify({
      senderId: response.getFromuser().getUserid(),
      senderName: response.getFromuser().getUsername(),
      message: response.getTextmessage(),
      timestamp: new Date().toISOString(),
      isGroup: false
    })}\n\n`);
  });
  stream.on('error', () => res.end());
  req.on('close', () => stream.cancel());
});

app.get('/api/messages/group/stream', (req, res) => {
  if (!req.isAuthenticated) return res.status(401).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const request = new group_pb.ReceiveMessageRequest();
  const fromUser = new common_pb.MessageUser();
  fromUser.setUserid(parseInt(req.session.user.userId));
  fromUser.setUsername(req.session.user.userName);
  request.setFromuser(fromUser);

  const stream = groupClient.receiveUserMessage(request);
  stream.on('data', (response) => {
    res.write(`data: ${JSON.stringify({
      senderId: response.getFromuser().getUserid(),
      senderName: response.getFromuser().getUsername(),
      groupId: response.getGroupid(),
      message: response.getTextmessage(),
      timestamp: new Date().toISOString(),
      isGroup: true
    })}\n\n`);
  });
  stream.on('error', () => res.end());
  req.on('close', () => stream.cancel());
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));