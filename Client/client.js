const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/grpc-js');
const path = require('path');


const createorloginProto = require('./createorlogin_grpc_pb'); 
const messages = require('./createorlogin_pb');


const client = new createorloginProto.AccountServiceClient(
  'localhost:8000',
  grpc.credentials.createInsecure()
);


function createAccount(user_name, display_name, password) {

  const request = new messages.CreateAccountRequest();
  request.setUserName(user_name);
  request.setDisplayName(display_name);
  request.setPassword(password);

  console.log("Sending request:", request.toObject());


  client.createAccount(request, (err, response) => {
    if (err) {
      console.error('Error creating account:', err);
      return;
    }

    console.log('CreateAccount Response:', response.toObject());
  });
}


function loginAccount(user_name, password) {

  const request = new messages.LoginAccountRequest();
  request.setUserName(user_name);
  request.setPassword(password);

  console.log("Sending request:", request.toObject());


  client.loginAccount(request, (err, response) => {
    if (err) {
      console.error('Error logging in:', err);
      return;
    }

    console.log('LoginAccount Response:', response.toObject());
  });
}


createAccount('Abi', 'TESTING', 'abc');
loginAccount('Abi', 'abc');