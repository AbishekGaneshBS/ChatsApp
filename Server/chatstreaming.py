import asyncio
import sqlite3
from datetime import datetime
from typing import AsyncIterator, Dict, List, Tuple

import grpc
from concurrent import futures

from Services import common_pb2 as common_pb
from Services import user_pb2 as user_pb
from Services import user_pb2_grpc as user_pb_grpc
from Services import group_pb2 as group_pb
from Services import group_pb2_grpc as group_pb_grpc


class DatabaseManager:
    def __init__(self, db_path: str = "chatsapp.db"):
        self.db_path = db_path
        self._initialize_db()

    def _initialize_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn


class ChatManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.active_user_streams: Dict[int, asyncio.Queue] = {}
        self.active_group_streams: Dict[int, Dict[int, asyncio.Queue]] = {}

    async def add_user_stream(self, user_id: int, queue: asyncio.Queue):
        self.active_user_streams[user_id] = queue

    async def remove_user_stream(self, user_id: int):
        self.active_user_streams.pop(user_id, None)

    async def add_group_stream(self, group_id: int, user_id: int, queue: asyncio.Queue):
        if group_id not in self.active_group_streams:
            self.active_group_streams[group_id] = {}
        self.active_group_streams[group_id][user_id] = queue

    async def remove_group_stream(self, group_id: int, user_id: int):
        if group_id in self.active_group_streams:
            self.active_group_streams[group_id].pop(user_id, None)
            if not self.active_group_streams[group_id]:
                self.active_group_streams.pop(group_id)

    async def send_user_message(self, sender_id: int, receiver_id: int, message: str):
        timestamp = datetime.now().isoformat()
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO UserToUserMessages (Sender_ID, Receiver_ID, Message) VALUES (?, ?, ?)",
                (sender_id, receiver_id, message)
            )
            conn.commit()

        # Notify receiver if online
        if receiver_id in self.active_user_streams:
            queue = self.active_user_streams[receiver_id]
            await queue.put((sender_id, message, timestamp))

    async def send_group_message(self, sender_id: int, group_id: int, message: str):
        timestamp = datetime.now().isoformat()
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO GroupMessages (Group_ID, Sender_ID, Message) VALUES (?, ?, ?)",
                (group_id, sender_id, message)
            )
            conn.commit()

            # Get all group members except sender
            cursor.execute(
                "SELECT User_ID FROM GroupMembers WHERE Group_ID = ? AND User_ID != ?",
                (group_id, sender_id)
            )
            members = cursor.fetchall()

        # Notify all online group members
        if group_id in self.active_group_streams:
            for member_id, in members:
                if member_id in self.active_group_streams[group_id]:
                    queue = self.active_group_streams[group_id][member_id]
                    await queue.put((sender_id, group_id, message, timestamp))

    async def load_user_messages(self, user1_id: int, user2_id: int) -> List[Tuple[int, str, str]]:
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Sender_ID, Message, Sent_At 
                FROM UserToUserMessages 
                WHERE (Sender_ID = ? AND Receiver_ID = ?) OR (Sender_ID = ? AND Receiver_ID = ?)
                ORDER BY Sent_At
            """, (user1_id, user2_id, user2_id, user1_id))
            return cursor.fetchall()

    async def load_group_messages(self, group_id: int) -> List[Tuple[int, str, str]]:
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT Sender_ID, Message, Sent_At 
                FROM GroupMessages 
                WHERE Group_ID = ?
                ORDER BY Sent_At
            """, (group_id,))
            return cursor.fetchall()

    async def get_user_name(self, user_id: int) -> str:
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT User_Name FROM Users WHERE User_ID = ?", (user_id,))
            result = cursor.fetchone()
            return result[0] if result else "Unknown"


class UserChatService(user_pb_grpc.UserChatServiceServicer):
    def __init__(self, chat_manager: ChatManager):
        self.chat_manager = chat_manager

    async def LoadUserMessage(self, request: user_pb.LoadMessageRequest, context) -> user_pb.LoadMessageResponse:
        from_user_id = request.fromuser.user_id
        to_user_id = request.touser.user_id

        messages = await self.chat_manager.load_user_messages(from_user_id, to_user_id)
        
        response = user_pb.LoadMessageResponse()
        for sender_id, message, timestamp in messages:
            sender_name = await self.chat_manager.get_user_name(sender_id)
            
            sender = common_pb.MessageUser(
                user_id=sender_id,
                user_name=sender_name,
                timestamp=timestamp
            )
            
            receiver_id = to_user_id if sender_id == from_user_id else from_user_id
            receiver_name = await self.chat_manager.get_user_name(receiver_id)
            
            receiver = common_pb.MessageUser(
                user_id=receiver_id,
                user_name=receiver_name,
                timestamp=timestamp
            )
            
            response.sender.append(sender)
            response.receiver.append(receiver)
            response.message.append(message)
            response.timestamp.append(timestamp)
        
        return response

    async def SendUserMessage(self, request_iterator: AsyncIterator[user_pb.SendMessageRequest], 
                            context) -> AsyncIterator[user_pb.SendMessageResponse]:
        async for request in request_iterator:
            from_user_id = request.fromuser.user_id
            to_user_id = request.touser.user_id
            message = request.textmessage

            await self.chat_manager.send_user_message(from_user_id, to_user_id, message)
            
            yield user_pb.SendMessageResponse(
                response=common_pb.MessageResponseStatus.MESSAGESUCCESS
            )

    async def ReceiveUserMessage(self, request_iterator: AsyncIterator[user_pb.ReceiveMessageRequest], 
                               context) -> AsyncIterator[user_pb.ReceiveMessageResponse]:
        user_id = None
        message_queue = asyncio.Queue()

        # Handle registration and messages
        async for request in request_iterator:
            if user_id is None:
                user_id = request.fromuser.user_id
                await self.chat_manager.add_user_stream(user_id, message_queue)
                continue

        try:
            while True:
                sender_id, message, timestamp = await message_queue.get()
                sender_name = await self.chat_manager.get_user_name(sender_id)
                
                yield user_pb.ReceiveMessageResponse(
                    fromuser=common_pb.MessageUser(
                        user_id=sender_id,
                        user_name=sender_name,
                        timestamp=timestamp
                    ),
                    textmessage=message
                )
        finally:
            if user_id:
                await self.chat_manager.remove_user_stream(user_id)


class GroupChatService(group_pb_grpc.UserChatServiceServicer):
    def __init__(self, chat_manager: ChatManager):
        self.chat_manager = chat_manager

    async def SendUserMessage(self, request_iterator: AsyncIterator[group_pb.SendMessageRequest], 
                            context) -> AsyncIterator[group_pb.SendMessageResponse]:
        async for request in request_iterator:
            from_user_id = request.fromuser.user_id
            group_id = request.groupid
            message = request.textmessage

            await self.chat_manager.send_group_message(from_user_id, group_id, message)
            
            yield group_pb.SendMessageResponse(
                response=common_pb.MessageResponseStatus.MESSAGESUCCESS
            )

    async def ReceiveUserMessage(self, request_iterator: AsyncIterator[group_pb.ReceiveMessageRequest], 
                               context) -> AsyncIterator[group_pb.ReceiveMessageResponse]:
        user_id = None
        group_id = None
        message_queue = asyncio.Queue()

        # Handle registration and messages
        async for request in request_iterator:
            if user_id is None:
                user_id = request.fromuser.user_id
                # In a real implementation, you'd get group_id from somewhere
                # For this example, we'll assume it's set elsewhere
                group_id = 1  # This should be dynamic in production
                await self.chat_manager.add_group_stream(group_id, user_id, message_queue)
                continue

        try:
            while True:
                sender_id, group_id, message, timestamp = await message_queue.get()
                sender_name = await self.chat_manager.get_user_name(sender_id)
                
                yield group_pb.ReceiveMessageResponse(
                    fromuser=common_pb.MessageUser(
                        user_id=sender_id,
                        user_name=sender_name,
                        timestamp=timestamp
                    ),
                    textmessage=message,
                    groupid=group_id
                )
        finally:
            if user_id and group_id:
                await self.chat_manager.remove_group_stream(group_id, user_id)


async def serve():
    db_manager = DatabaseManager()
    chat_manager = ChatManager(db_manager)
    
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    
    user_pb_grpc.add_UserChatServiceServicer_to_server(
        UserChatService(chat_manager), server)
    group_pb_grpc.add_UserChatServiceServicer_to_server(
        GroupChatService(chat_manager), server)
    
    server.add_insecure_port('[::]:50051')
    await server.start()
    print("Server started on port 50051")
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        await server.stop(0)


if __name__ == '__main__':
    asyncio.run(serve())