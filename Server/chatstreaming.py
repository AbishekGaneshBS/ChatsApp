import asyncio
import sqlite3
from datetime import datetime
from typing import AsyncIterator, Dict, List, Tuple, Optional

import grpc
from concurrent import futures
import sys
sys.path.append("Services") 
from Services import common_pb2 as common_pb
from Services import user_pb2 as user_pb
from Services import user_pb2_grpc as user_pb_grpc
from Services import groups_pb2 as group_pb
from Services import groups_pb2_grpc as group_pb_grpc


class DatabaseManager:
    def __init__(self, db_path: str = "./DataBase/database.db"):
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

    async def _verify_user_exists(self, user_id: int) -> bool:
        """Check if user exists in database"""
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM Users WHERE User_ID = ?", (user_id,))
            return cursor.fetchone() is not None

    async def _verify_group_member(self, user_id: int, group_id: int) -> bool:
        """Check if user is member of group"""
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM GroupMembers WHERE Group_ID = ? AND User_ID = ?",
                (group_id, user_id)
            )
            return cursor.fetchone() is not None

    async def add_user_stream(self, user_id: int, queue: asyncio.Queue):
        if not await self._verify_user_exists(user_id):
            raise ValueError(f"User {user_id} does not exist")
        self.active_user_streams[user_id] = queue

    async def remove_user_stream(self, user_id: int):
        self.active_user_streams.pop(user_id, None)

    async def add_group_stream(self, group_id: int, user_id: int, queue: asyncio.Queue):
        if not await self._verify_group_member(user_id, group_id):
            raise ValueError(f"User {user_id} not in group {group_id}")
            
        if group_id not in self.active_group_streams:
            self.active_group_streams[group_id] = {}
        self.active_group_streams[group_id][user_id] = queue

    async def remove_group_stream(self, group_id: int, user_id: int):
        if group_id in self.active_group_streams:
            self.active_group_streams[group_id].pop(user_id, None)
            if not self.active_group_streams[group_id]:
                self.active_group_streams.pop(group_id)

    async def send_user_message(self, sender_id: int, receiver_id: int, message: str) -> bool:
        """Returns True if message was successfully sent"""
        if not await self._verify_user_exists(sender_id):
            raise ValueError(f"Sender {sender_id} does not exist")
        if not await self._verify_user_exists(receiver_id):
            raise ValueError(f"Receiver {receiver_id} does not exist")

        timestamp = datetime.now().isoformat()
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO UserToUserMessages (Sender_ID, Receiver_ID, Message) VALUES (?, ?, ?)",
                    (sender_id, receiver_id, message)
                )
                conn.commit()

            if receiver_id in self.active_user_streams:
                queue = self.active_user_streams[receiver_id]
                await queue.put((sender_id, message, timestamp))
            
            return True
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return False

    async def send_group_message(self, sender_id: int, group_id: int, message: str) -> bool:
        """Returns True if message was successfully sent to group"""
        if not await self._verify_user_exists(sender_id):
            raise ValueError(f"Sender {sender_id} does not exist")
        if not await self._verify_group_member(sender_id, group_id):
            raise ValueError(f"Sender {sender_id} not in group {group_id}")

        timestamp = datetime.now().isoformat()
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO GroupMessages (Group_ID, Sender_ID, Message) VALUES (?, ?, ?)",
                    (group_id, sender_id, message)
                )
                
                # Get all group members except sender
                cursor.execute(
                    "SELECT User_ID FROM GroupMembers WHERE Group_ID = ? AND User_ID != ?",
                    (group_id, sender_id)
                )
                members = [row[0] for row in cursor.fetchall()]
                conn.commit()

            # Notify online group members
            if group_id in self.active_group_streams:
                for member_id in members:
                    if member_id in self.active_group_streams[group_id]:
                        queue = self.active_group_streams[group_id][member_id]
                        await queue.put((sender_id, group_id, message, timestamp))
            
            return True
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return False

    async def load_user_messages(self, user1_id: int, user2_id: int) -> List[Tuple[int, str, str]]:
        """Returns list of (sender_id, message, timestamp) tuples"""
        if not (await self._verify_user_exists(user1_id) and await self._verify_user_exists(user2_id)):
            return []

        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Sender_ID, Message, Sent_At 
                    FROM UserToUserMessages 
                    WHERE (Sender_ID = ? AND Receiver_ID = ?) OR (Sender_ID = ? AND Receiver_ID = ?)
                    ORDER BY Sent_At
                """, (user1_id, user2_id, user2_id, user1_id))
                return cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []

    async def load_group_messages(self, group_id: int) -> List[Tuple[int, str, str]]:
        """Returns list of (sender_id, message, timestamp) tuples"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Sender_ID, Message, Sent_At 
                    FROM GroupMessages 
                    WHERE Group_ID = ?
                    ORDER BY Sent_At
                """, (group_id,))
                return cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Database error: {e}")
            return []

    async def get_user_name(self, user_id: int) -> str:
        """Returns username or 'Unknown' if not found"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT User_Name FROM Users WHERE User_ID = ?", (user_id,))
                result = cursor.fetchone()
                return result[0] if result else "Unknown"
        except sqlite3.Error:
            return "Unknown"


class UserChatService(user_pb_grpc.UserChatServiceServicer):
    def __init__(self, chat_manager: ChatManager):
        self.chat_manager = chat_manager

    async def LoadMessages(self, request: user_pb.LoadMessageRequest, context) -> user_pb.LoadMessageResponse:
        response = user_pb.LoadMessageResponse()
        try:
            from_user_id = request.fromuser.userid
            to_user_id = request.touser.userid

            messages = await self.chat_manager.load_user_messages(from_user_id, to_user_id)
            
            for sender_id, message, timestamp in messages:
                sender_name = await self.chat_manager.get_user_name(sender_id)
                
                sender = common_pb.MessageUser(
                    userid=sender_id,
                    username=sender_name,
                    timestamp=timestamp
                )
                
                receiver_id = to_user_id if sender_id == from_user_id else from_user_id
                receiver_name = await self.chat_manager.get_user_name(receiver_id)
                
                receiver = common_pb.MessageUser(
                    userid=receiver_id,
                    username=receiver_name,
                    timestamp=timestamp
                )
                
                response.sender.append(sender)
                response.receiver.append(receiver)
                response.message.append(message)
                response.timestamp.append(timestamp)
        except Exception as e:
            print(f"Error in LoadUserMessage: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("Failed to load messages")
        return response

    async def SendMessages(self, request_iterator: AsyncIterator[user_pb.SendMessageRequest], 
                            context) -> AsyncIterator[user_pb.SendMessageResponse]:
        async for request in request_iterator:
            response = user_pb.SendMessageResponse()
            try:
                from_user_id = request.fromuser.userid
                to_user_id = request.touser.userid
                message = request.textmessage

                success = await self.chat_manager.send_user_message(from_user_id, to_user_id, message)
                response.response = (
                    common_pb.MessageResponseStatus.MESSAGESUCCESS if success
                    else common_pb.MessageResponseStatus.MESSAGEFAILURE
                )
            except ValueError as e:
                print(f"Validation error: {e}")
                response.response = common_pb.MessageResponseStatus.MESSAGEFAILURE
            except Exception as e:
                print(f"Error in SendUserMessage: {e}")
                response.response = common_pb.MessageResponseStatus.MESSAGEFAILURE
            
            yield response

    async def ReceiveMessages(self, request_iterator: AsyncIterator[user_pb.ReceiveMessageRequest], 
                               context) -> AsyncIterator[user_pb.ReceiveMessageResponse]:
        user_id = None
        message_queue = asyncio.Queue()

        try:
            async for request in request_iterator:
                if user_id is None:
                    user_id = request.fromuser.userid
                    await self.chat_manager.add_user_stream(user_id, message_queue)
                    continue

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
        except Exception as e:
            print(f"Error in ReceiveUserMessage: {e}")
        finally:
            if user_id:
                await self.chat_manager.remove_user_stream(user_id)


class GroupChatService(group_pb_grpc.GroupChatServiceServicer):
    def __init__(self, chat_manager: ChatManager):
        self.chat_manager = chat_manager

    async def SendMessage(self, request_iterator: AsyncIterator[group_pb.SendMessageRequest], 
                            context) -> AsyncIterator[group_pb.SendMessageResponse]:
        async for request in request_iterator:
            response = group_pb.SendMessageResponse()
            try:
                from_user_id = request.fromuser.userid
                group_id = request.groupid
                message = request.textmessage

                success = await self.chat_manager.send_group_message(from_user_id, group_id, message)
                response.response = (
                    common_pb.MessageResponseStatus.MESSAGESUCCESS if success
                    else common_pb.MessageResponseStatus.MESSAGEFAILURE
                )
            except ValueError as e:
                print(f"Validation error: {e}")
                response.response = common_pb.MessageResponseStatus.MESSAGEFAILURE
            except Exception as e:
                print(f"Error in SendUserMessage: {e}")
                response.response = common_pb.MessageResponseStatus.MESSAGEFAILURE
            
            yield response

    async def ReceiveMessages(self, request_iterator: AsyncIterator[group_pb.ReceiveMessageRequest], 
                               context) -> AsyncIterator[group_pb.ReceiveMessageResponse]:
        user_id = None
        group_id = None
        message_queue = asyncio.Queue()

        try:
            async for request in request_iterator:
                if user_id is None:
                    user_id = request.fromuser.userid
                    group_id = request.groupid  # Now properly getting group_id from request
                    await self.chat_manager.add_group_stream(group_id, user_id, message_queue)
                    continue

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
        except Exception as e:
            print(f"Error in ReceiveUserMessage: {e}")
        finally:
            if user_id and group_id:
                await self.chat_manager.remove_group_stream(group_id, user_id)



async def serve():
    db_manager = DatabaseManager()
    chat_manager = ChatManager(db_manager)
    
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    
    user_pb_grpc.add_UserChatServiceServicer_to_server(
        UserChatService(chat_manager), server)
    group_pb_grpc.add_GroupChatServiceServicer_to_server(
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