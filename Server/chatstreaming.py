import asyncio
from datetime import datetime
from typing import AsyncIterator, Dict, List, Optional, Tuple
import grpc
from concurrent import futures
import sys
import aiosqlite
from aiosqlite import Connection

sys.path.append("Services")
from Services import common_pb2 as common_pb
from Services import user_pb2 as user_pb
from Services import user_pb2_grpc as user_pb_grpc

class DatabaseManager:
    def __init__(self, db_path: str = "./DataBase/database.db"):
        self.db_path = db_path
        
    async def initialize(self):
        """Initialize the database connection and tables"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA foreign_keys = ON")
            await db.execute("""
                CREATE TABLE IF NOT EXISTS Users (
                    User_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    User_Name TEXT NOT NULL UNIQUE,
                    Display_Name TEXT NOT NULL
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS UserToUserMessages (
                    Message_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                    Sender_ID INTEGER NOT NULL,
                    Receiver_ID INTEGER NOT NULL,
                    Message TEXT NOT NULL,
                    Sent_At TEXT NOT NULL,
                    Is_Read INTEGER DEFAULT 0,
                    FOREIGN KEY (Sender_ID) REFERENCES Users(User_ID),
                    FOREIGN KEY (Receiver_ID) REFERENCES Users(User_ID)
                )
            """)
            await db.commit()

    async def load_user_messages(self, user1_id: int, user2_id: int) -> List[Tuple[int, str, str]]:
        """Load messages between two users"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT Sender_ID, Message, Sent_At 
                FROM UserToUserMessages 
                WHERE (Sender_ID = ? AND Receiver_ID = ?) 
                   OR (Sender_ID = ? AND Receiver_ID = ?)
                ORDER BY Sent_At
            """, (user1_id, user2_id, user2_id, user1_id)) as cursor:
                return await cursor.fetchall()

    async def get_user_name(self, user_id: int) -> Optional[str]:
        """Get username by user ID"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT User_Name FROM Users WHERE User_ID = ?
            """, (user_id,)) as cursor:
                result = await cursor.fetchone()
                return result[0] if result else None

    async def verify_user_exists(self, user_id: int) -> bool:
        """Check if user exists"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT 1 FROM Users WHERE User_ID = ?
            """, (user_id,)) as cursor:
                return await cursor.fetchone() is not None

    async def mark_message_as_read(self, receiver_id: int, sender_id: int, message: str, timestamp: str):
        """Mark a specific message as read"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                UPDATE UserToUserMessages 
                SET Is_Read = 1 
                WHERE Receiver_ID = ? AND Sender_ID = ? AND Message = ? AND Sent_At = ?
            """, (receiver_id, sender_id, message, timestamp))
            await db.commit()

    async def get_unread_messages(self, user_id: int) -> List[Tuple[int, str, str]]:
        """Get all unread messages for a user"""
        async with aiosqlite.connect(self.db_path) as db:
            async with db.execute("""
                SELECT Sender_ID, Message, Sent_At 
                FROM UserToUserMessages 
                WHERE Receiver_ID = ? AND Is_Read = 0
                ORDER BY Sent_At
            """, (user_id,)) as cursor:
                return await cursor.fetchall()

    async def send_message(self, sender_id: int, receiver_id: int, message: str) -> bool:
        """Send a new message"""
        timestamp = datetime.now().isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            try:
                await db.execute(
                    "INSERT INTO UserToUserMessages (Sender_ID, Receiver_ID, Message, Sent_At) VALUES (?, ?, ?, ?)",
                    (sender_id, receiver_id, message, timestamp)
                )
                await db.commit()
                return True
            except Exception as e:
                print(f"Failed to send message: {e}")
                return False

class ChatManager:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.active_user_streams: Dict[int, asyncio.Queue] = {}

    async def _verify_user_exists(self, user_id: int) -> bool:
        """Check if user exists"""
        return await self.db_manager.verify_user_exists(user_id)

    async def add_user_stream(self, user_id: int, queue: asyncio.Queue):
        """Add a new user message stream"""
        if not await self._verify_user_exists(user_id):
            raise ValueError(f"User {user_id} does not exist")
        self.active_user_streams[user_id] = queue

    async def remove_user_stream(self, user_id: int):
        """Remove a user message stream"""
        self.active_user_streams.pop(user_id, None)

    async def send_user_message(self, sender_id: int, receiver_id: int, message: str) -> bool:
        """Send message from one user to another"""
        if not await self._verify_user_exists(sender_id):
            raise ValueError(f"Sender {sender_id} does not exist")
        if not await self._verify_user_exists(receiver_id):
            raise ValueError(f"Receiver {receiver_id} does not exist")

        success = await self.db_manager.send_message(sender_id, receiver_id, message)
        if success and receiver_id in self.active_user_streams:
            timestamp = datetime.now().isoformat()
            queue = self.active_user_streams[receiver_id]
            await queue.put((sender_id, message, timestamp))
        
        return success

    async def load_user_messages(self, user1_id: int, user2_id: int) -> List[Tuple[int, str, str]]:
        """Load messages between two users"""
        if not (await self._verify_user_exists(user1_id) and await self._verify_user_exists(user2_id)):
            return []
        return await self.db_manager.load_user_messages(user1_id, user2_id)

    async def get_user_name(self, user_id: int) -> str:
        """Get username with fallback to 'Unknown'"""
        name = await self.db_manager.get_user_name(user_id)
        return name if name else "Unknown"

    async def get_unread_messages(self, user_id: int) -> List[Tuple[int, str, str]]:
        """Get unread messages for a user"""
        return await self.db_manager.get_unread_messages(user_id)

    async def message_read(self, receiver_id: int, sender_id: int, message: str, timestamp: str):
        """Mark message as read"""
        await self.db_manager.mark_message_as_read(receiver_id, sender_id, message, timestamp)

class UserChatService(user_pb_grpc.UserChatServiceServicer):
    def __init__(self, chat_manager: ChatManager):
        self.chat_manager = chat_manager
        self._active_tasks = set()

    async def _cleanup_task(self, task):
        """Cleanup background tasks"""
        try:
            await task
        except Exception as e:
            print(f"Background task failed: {e}")
        finally:
            self._active_tasks.discard(task)

    async def LoadMessages(self, request: user_pb.LoadMessageRequest, context) -> user_pb.LoadMessageResponse:
        """gRPC method to load messages between users"""
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
                    sentat=timestamp
                )
                
                receiver_id = to_user_id if sender_id == from_user_id else from_user_id
                receiver_name = await self.chat_manager.get_user_name(receiver_id)
                
                receiver = common_pb.MessageUser(
                    userid=receiver_id,
                    username=receiver_name,
                    sentat=timestamp
                )
                
                response.senders.append(sender)
                response.receivers.append(receiver)
                response.messages.append(message)
                response.timestamps.append(timestamp)
                
        except ValueError as e:
            context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
            context.set_details(str(e))
        except Exception as e:
            print(f"Error in LoadMessages: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("Failed to load messages")
            
        return response

    async def SendMessages(self, request_iterator: AsyncIterator[user_pb.SendMessageRequest], 
                         context) -> AsyncIterator[user_pb.SendMessageResponse]:
        """gRPC method to send messages"""
        try:
            async for request in request_iterator:
                response = user_pb.SendMessageResponse()
                try:
                    from_user_id = request.sender.userid
                    to_user_id = request.receiver.userid
                    message = request.message
                    
                    success = await self.chat_manager.send_user_message(from_user_id, to_user_id, message)
                    response.status = (
                        common_pb.MessageStatus.DELIVERED if success
                        else common_pb.MessageStatus.FAILED
                    )
                except ValueError as e:
                    print(f"Validation error: {e}")
                    response.status = common_pb.MessageStatus.FAILED
                    context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                    context.set_details(str(e))
                except Exception as e:
                    print(f"Error in SendMessages: {e}")
                    response.status = common_pb.MessageStatus.FAILED
                    context.set_code(grpc.StatusCode.INTERNAL)
                    context.set_details("Internal server error")
                
                yield response
        except Exception as e:
            print(f"SendMessages stream error: {e}")

    async def ReceiveMessages(self, request: user_pb.ReceiveMessageRequest, 
                        context: grpc.aio.ServicerContext) -> AsyncIterator[user_pb.ReceiveMessageResponse]:
        """gRPC method to receive messages in real-time"""
        user_id = request.fromuser.userid
        print(f"User {user_id} connected to message stream")
        
        try:
            while True:
                try:
                    messages = await self.chat_manager.get_unread_messages(user_id)
                    if messages:
                        for sender_id, message, timestamp in messages:
                            sender_name = await self.chat_manager.get_user_name(sender_id)
                            
                            if user_id != sender_id:
                                await self.chat_manager.message_read(user_id, sender_id, message, timestamp)

                            yield user_pb.ReceiveMessageResponse(
                                sender=common_pb.MessageUser(
                                    userid=sender_id,
                                    username=sender_name,
                                    sentat=timestamp
                                ),
                                message=message
                            )
                    
                    await asyncio.sleep(1)
                    
                except grpc.RpcError as rpc_error:
                    if rpc_error.code() == grpc.StatusCode.CANCELLED:
                        print(f"User {user_id} disconnected normally")
                        break
                    raise
                    
        except Exception as e:
            print(f"Error in ReceiveMessages for user {user_id}: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details("Message stream error")
        finally:
            print(f"User {user_id} fully disconnected")

async def serve():
    """Start the gRPC server"""
    db_manager = DatabaseManager()
    await db_manager.initialize()
    
    chat_manager = ChatManager(db_manager)
    
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    user_pb_grpc.add_UserChatServiceServicer_to_server(
        UserChatService(chat_manager), server)
    
    server.add_insecure_port('[::]:50051')
    await server.start()
    print("Server started on port 50051")

    try:
        while True:
            await asyncio.sleep(3600)
    except KeyboardInterrupt:
        print("\nShutting down server...")
        await server.stop(5)
    finally:
        print("Server shutdown complete")

if __name__ == '__main__':
    asyncio.run(serve())