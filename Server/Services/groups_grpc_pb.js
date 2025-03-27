// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var groups_pb = require('./groups_pb.js');
var common_pb = require('./common_pb.js');

function serialize_ChatsApp_group_ReceiveMessageRequest(arg) {
  if (!(arg instanceof groups_pb.ReceiveMessageRequest)) {
    throw new Error('Expected argument of type ChatsApp.group.ReceiveMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_group_ReceiveMessageRequest(buffer_arg) {
  return groups_pb.ReceiveMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_group_ReceiveMessageResponse(arg) {
  if (!(arg instanceof groups_pb.ReceiveMessageResponse)) {
    throw new Error('Expected argument of type ChatsApp.group.ReceiveMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_group_ReceiveMessageResponse(buffer_arg) {
  return groups_pb.ReceiveMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_group_SendMessageRequest(arg) {
  if (!(arg instanceof groups_pb.SendMessageRequest)) {
    throw new Error('Expected argument of type ChatsApp.group.SendMessageRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_group_SendMessageRequest(buffer_arg) {
  return groups_pb.SendMessageRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_ChatsApp_group_SendMessageResponse(arg) {
  if (!(arg instanceof groups_pb.SendMessageResponse)) {
    throw new Error('Expected argument of type ChatsApp.group.SendMessageResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_ChatsApp_group_SendMessageResponse(buffer_arg) {
  return groups_pb.SendMessageResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var UserChatServiceService = exports.UserChatServiceService = {
  sendUserMessage: {
    path: '/ChatsApp.group.UserChatService/SendUserMessage',
    requestStream: true,
    responseStream: true,
    requestType: groups_pb.SendMessageRequest,
    responseType: groups_pb.SendMessageResponse,
    requestSerialize: serialize_ChatsApp_group_SendMessageRequest,
    requestDeserialize: deserialize_ChatsApp_group_SendMessageRequest,
    responseSerialize: serialize_ChatsApp_group_SendMessageResponse,
    responseDeserialize: deserialize_ChatsApp_group_SendMessageResponse,
  },
  receiveUserMessage: {
    path: '/ChatsApp.group.UserChatService/ReceiveUserMessage',
    requestStream: true,
    responseStream: true,
    requestType: groups_pb.ReceiveMessageRequest,
    responseType: groups_pb.ReceiveMessageResponse,
    requestSerialize: serialize_ChatsApp_group_ReceiveMessageRequest,
    requestDeserialize: deserialize_ChatsApp_group_ReceiveMessageRequest,
    responseSerialize: serialize_ChatsApp_group_ReceiveMessageResponse,
    responseDeserialize: deserialize_ChatsApp_group_ReceiveMessageResponse,
  },
};

exports.UserChatServiceClient = grpc.makeGenericClientConstructor(UserChatServiceService, 'UserChatService');
