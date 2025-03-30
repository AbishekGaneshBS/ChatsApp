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

    async def _verify_user_exists(self, user_id: int) -> bool:
        with self.db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM Users WHERE User_ID = ?", (user_id,))
            return cursor.fetchone() is not None

    async def add_user_stream(self, user_id: int, queue: asyncio.Queue):
        if not await self._verify_user_exists(user_id):
            raise ValueError(f"User {user_id} does not exist")
        self.active_user_streams[user_id] = queue

    async def remove_user_stream(self, user_id: int):
        self.active_user_streams.pop(user_id, None)

    async def send_user_message(self, sender_id: int, receiver_id: int, message: str) -> bool:
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

    async def load_user_messages(self, user1_id: int, user2_id: int) -> List[Tuple[int, str, str]]:
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

    async def get_user_name(self, user_id: int) -> str:
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT User_Name FROM Users WHERE User_ID = ?", (user_id,))
                result = cursor.fetchone()
                return result[0] if result else "Unknown"
        except sqlite3.Error:
            return "Unknown"

    async def get_unread_messages(self, senderid: int) -> List[Tuple[int, str, str]]:
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT Sender_ID, Message, Sent_At 
                    FROM UserToUserMessages 
                    WHERE (Receiver_ID = ? OR Sender_ID = ?) AND Is_Read = 0
                    ORDER BY Sent_At
                """, (senderid, senderid))
                return cursor.fetchall()
        except sqlite3.Error:
            return "Unknown"

    def message_read(self, user_id: int, sender_id: int, message: str, timestamp: str):
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""UPDATE UserToUserMessages SET Is_Read = 1 WHERE Receiver_ID = ? AND Sender_ID = ? AND Message = ? AND Sent_At = ?""", (user_id, sender_id, message, timestamp))
                conn.commit()
                return
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
            except Exception as e:
                print(f"Error in SendUserMessage: {e}")
                response.status = common_pb.MessageStatus.FAILED
            
            yield response

    async def ReceiveMessages(self, request: user_pb.ReceiveMessageRequest, 
                         context) -> AsyncIterator[user_pb.ReceiveMessageResponse]:
        try:
            user_id = request.fromuser.userid
            print(f"User {user_id} connected to message stream")
            while True:
                messages = await self.chat_manager.get_unread_messages(user_id)
                if messages:
                    for sender_id, message, timestamp in messages:
                        sender_name = await self.chat_manager.get_user_name(sender_id)
                        
                        if user_id != sender_id:
                            self.chat_manager.message_read(user_id, sender_id, message, timestamp)

                            

                        yield user_pb.ReceiveMessageResponse(
                            sender=common_pb.MessageUser(
                                userid=sender_id,
                                username=sender_name,
                                sentat=timestamp
                            ),
                            message=message  
                        )
                await asyncio.sleep(1)
                
                

        except Exception as e:
            print(f"Error in message stream: {e}")
        finally:
            print(f"User {user_id} disconnected from message stream")
            conn.close()

async def monitor_quit_command():
    loop = asyncio.get_running_loop()
    while True:
        user_input = await loop.run_in_executor(None, input, "Press 'q' + Enter to quit...\n")
        if user_input.strip().lower() == 'q':
            print("Stopping server...")
            return True  

async def serve():
    db_manager = DatabaseManager()
    chat_manager = ChatManager(db_manager)
    
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))
    
    user_pb_grpc.add_UserChatServiceServicer_to_server(
        UserChatService(chat_manager), server)
    
    server.add_insecure_port('[::]:50051')
    await server.start()
    print("Server started on port 50051")

    server_task = asyncio.create_task(server.wait_for_termination())
    quit_task = asyncio.create_task(monitor_quit_command())

    done, pending = await asyncio.wait(
        [server_task, quit_task],
        return_when=asyncio.FIRST_COMPLETED
    )

    if quit_task in done:
        print("Shutting down")
        await server.stop(0)
    else:
        quit_task.cancel() 

if __name__ == '__main__':
    asyncio.run(serve())