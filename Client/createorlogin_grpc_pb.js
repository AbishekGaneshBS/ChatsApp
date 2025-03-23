// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var createorlogin_pb = require('./createorlogin_pb.js');

function serialize_createorlogin_v1_CreateAccountRequest(arg) {
  if (!(arg instanceof createorlogin_pb.CreateAccountRequest)) {
    throw new Error('Expected argument of type createorlogin.v1.CreateAccountRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_createorlogin_v1_CreateAccountRequest(buffer_arg) {
  return createorlogin_pb.CreateAccountRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_createorlogin_v1_CreateAccountResponse(arg) {
  if (!(arg instanceof createorlogin_pb.CreateAccountResponse)) {
    throw new Error('Expected argument of type createorlogin.v1.CreateAccountResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_createorlogin_v1_CreateAccountResponse(buffer_arg) {
  return createorlogin_pb.CreateAccountResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_createorlogin_v1_LoginAccountRequest(arg) {
  if (!(arg instanceof createorlogin_pb.LoginAccountRequest)) {
    throw new Error('Expected argument of type createorlogin.v1.LoginAccountRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_createorlogin_v1_LoginAccountRequest(buffer_arg) {
  return createorlogin_pb.LoginAccountRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_createorlogin_v1_LoginAccountResponse(arg) {
  if (!(arg instanceof createorlogin_pb.LoginAccountResponse)) {
    throw new Error('Expected argument of type createorlogin.v1.LoginAccountResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_createorlogin_v1_LoginAccountResponse(buffer_arg) {
  return createorlogin_pb.LoginAccountResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var AccountServiceService = exports.AccountServiceService = {
  createAccount: {
    path: '/createorlogin.v1.AccountService/CreateAccount',
    requestStream: false,
    responseStream: false,
    requestType: createorlogin_pb.CreateAccountRequest,
    responseType: createorlogin_pb.CreateAccountResponse,
    requestSerialize: serialize_createorlogin_v1_CreateAccountRequest,
    requestDeserialize: deserialize_createorlogin_v1_CreateAccountRequest,
    responseSerialize: serialize_createorlogin_v1_CreateAccountResponse,
    responseDeserialize: deserialize_createorlogin_v1_CreateAccountResponse,
  },
  loginAccount: {
    path: '/createorlogin.v1.AccountService/LoginAccount',
    requestStream: false,
    responseStream: false,
    requestType: createorlogin_pb.LoginAccountRequest,
    responseType: createorlogin_pb.LoginAccountResponse,
    requestSerialize: serialize_createorlogin_v1_LoginAccountRequest,
    requestDeserialize: deserialize_createorlogin_v1_LoginAccountRequest,
    responseSerialize: serialize_createorlogin_v1_LoginAccountResponse,
    responseDeserialize: deserialize_createorlogin_v1_LoginAccountResponse,
  },
};

exports.AccountServiceClient = grpc.makeGenericClientConstructor(AccountServiceService, 'AccountService');
