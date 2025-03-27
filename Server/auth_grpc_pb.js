// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var auth_pb = require('./auth_pb.js');
var common_pb = require('./common_pb.js');

function serialize_ChatsApp_auth_CreateAccountRequest(arg) {
  if (!(arg instanceof auth_pb.CreateAccountRequest)) {
    throw new Error('Expected argument of type ChatsApp.auth.CreateAccountRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_auth_CreateAccountRequest(buffer_arg) {
  return auth_pb.CreateAccountRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_auth_CreateAccountResponse(arg) {
  if (!(arg instanceof auth_pb.CreateAccountResponse)) {
    throw new Error('Expected argument of type ChatsApp.auth.CreateAccountResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_auth_CreateAccountResponse(buffer_arg) {
  return auth_pb.CreateAccountResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_auth_LoginAccountRequest(arg) {
  if (!(arg instanceof auth_pb.LoginAccountRequest)) {
    throw new Error('Expected argument of type ChatsApp.auth.LoginAccountRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_auth_LoginAccountRequest(buffer_arg) {
  return auth_pb.LoginAccountRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_auth_LoginAccountResponse(arg) {
  if (!(arg instanceof auth_pb.LoginAccountResponse)) {
    throw new Error('Expected argument of type ChatsApp.auth.LoginAccountResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_auth_LoginAccountResponse(buffer_arg) {
  return auth_pb.LoginAccountResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var AccountServiceService = exports.AccountServiceService = {
  createAccount: {
    path: '/ChatsApp.auth.AccountService/CreateAccount',
    requestStream: false,
    responseStream: false,
    requestType: auth_pb.CreateAccountRequest,
    responseType: auth_pb.CreateAccountResponse,
    requestSerialize: serialize_ChatsApp_auth_CreateAccountRequest,
    requestDeserialize: deserialize_ChatsApp_auth_CreateAccountRequest,
    responseSerialize: serialize_ChatsApp_auth_CreateAccountResponse,
    responseDeserialize: deserialize_ChatsApp_auth_CreateAccountResponse,
  },
  loginAccount: {
    path: '/ChatsApp.auth.AccountService/LoginAccount',
    requestStream: false,
    responseStream: false,
    requestType: auth_pb.LoginAccountRequest,
    responseType: auth_pb.LoginAccountResponse,
    requestSerialize: serialize_ChatsApp_auth_LoginAccountRequest,
    requestDeserialize: deserialize_ChatsApp_auth_LoginAccountRequest,
    responseSerialize: serialize_ChatsApp_auth_LoginAccountResponse,
    responseDeserialize: deserialize_ChatsApp_auth_LoginAccountResponse,
  },
};

exports.AccountServiceClient = grpc.makeGenericClientConstructor(AccountServiceService, 'AccountService');
