// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var user_pb = require('./user_pb.js');
var common_pb = require('./common_pb.js');

function serialize_ChatsApp_user_LoadMessageRequest(arg) {
  if (!(arg instanceof user_pb.LoadMessageRequest)) {
    throw new Error('Expected argument of type ChatsApp.user.LoadMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_LoadMessageRequest(buffer_arg) {
  return user_pb.LoadMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_user_LoadMessageResponse(arg) {
  if (!(arg instanceof user_pb.LoadMessageResponse)) {
    throw new Error('Expected argument of type ChatsApp.user.LoadMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_LoadMessageResponse(buffer_arg) {
  return user_pb.LoadMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_user_ReceiveMessageRequest(arg) {
  if (!(arg instanceof user_pb.ReceiveMessageRequest)) {
    throw new Error('Expected argument of type ChatsApp.user.ReceiveMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_ReceiveMessageRequest(buffer_arg) {
  return user_pb.ReceiveMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_user_ReceiveMessageResponse(arg) {
  if (!(arg instanceof user_pb.ReceiveMessageResponse)) {
    throw new Error('Expected argument of type ChatsApp.user.ReceiveMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_ReceiveMessageResponse(buffer_arg) {
  return user_pb.ReceiveMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_user_SendMessageRequest(arg) {
  if (!(arg instanceof user_pb.SendMessageRequest)) {
    throw new Error('Expected argument of type ChatsApp.user.SendMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_SendMessageRequest(buffer_arg) {
  return user_pb.SendMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_user_SendMessageResponse(arg) {
  if (!(arg instanceof user_pb.SendMessageResponse)) {
    throw new Error('Expected argument of type ChatsApp.user.SendMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_user_SendMessageResponse(buffer_arg) {
  return user_pb.SendMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UserChatServiceService = exports.UserChatServiceService = {
  loadMessages: {
    path: '/ChatsApp.user.UserChatService/LoadMessages',
    requestStream: false,
    responseStream: false,
    requestType: user_pb.LoadMessageRequest,
    responseType: user_pb.LoadMessageResponse,
    requestSerialize: serialize_ChatsApp_user_LoadMessageRequest,
    requestDeserialize: deserialize_ChatsApp_user_LoadMessageRequest,
    responseSerialize: serialize_ChatsApp_user_LoadMessageResponse,
    responseDeserialize: deserialize_ChatsApp_user_LoadMessageResponse,
  },
  sendMessages: {
    path: '/ChatsApp.user.UserChatService/SendMessages',
    requestStream: true,
    responseStream: true,
    requestType: user_pb.SendMessageRequest,
    responseType: user_pb.SendMessageResponse,
    requestSerialize: serialize_ChatsApp_user_SendMessageRequest,
    requestDeserialize: deserialize_ChatsApp_user_SendMessageRequest,
    responseSerialize: serialize_ChatsApp_user_SendMessageResponse,
    responseDeserialize: deserialize_ChatsApp_user_SendMessageResponse,
  },
  receiveMessages: {
    path: '/ChatsApp.user.UserChatService/ReceiveMessages',
    requestStream: true,
    responseStream: true,
    requestType: user_pb.ReceiveMessageRequest,
    responseType: user_pb.ReceiveMessageResponse,
    requestSerialize: serialize_ChatsApp_user_ReceiveMessageRequest,
    requestDeserialize: deserialize_ChatsApp_user_ReceiveMessageRequest,
    responseSerialize: serialize_ChatsApp_user_ReceiveMessageResponse,
    responseDeserialize: deserialize_ChatsApp_user_ReceiveMessageResponse,
  },
};

exports.UserChatServiceClient = grpc.makeGenericClientConstructor(UserChatServiceService, 'UserChatService');
