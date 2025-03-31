from concurrent import futures
import sqlite3
import grpc
import bcrypt
from pathlib import Path
import sys
sys.path.append("Services") 
from Services import common_pb2
from Services import auth_pb2, auth_pb2_grpc
import threading


DB_PATH = 'DataBase/database.db'
SERVER_PORT = '[::]:8000'

server = None 

def initialize_database():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS Users (
                userid INTEGER PRIMARY KEY AUTOINCREMENT,
                User_Name TEXT NOT NULL UNIQUE,
                Display_Name TEXT NOT NULL,
                Password TEXT NOT NULL,
                Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_user_by_username(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT User_ID, User_Name, Display_Name, Password FROM Users WHERE User_Name = ?", (username.strip(),))
        return cursor.fetchone()

def get_all_users_except(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT User_ID, User_Name, Display_Name FROM Users WHERE User_Name != ?", (username.strip(),))
        return cursor.fetchall()

def get_all_groups(username: str):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT gm.User_ID, g.Group_Name FROM GroupMembers gm JOIN Users u ON gm.User_ID = u.User_ID JOIN Groups g ON gm.Group_ID = g.Group_ID WHERE u.User_Name = ?;", (username.strip(),))
        return cursor.fetchall()

def create_user(username: str, display_name: str, password: str):
    hashed_password = hash_password(password)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO Users (User_Name, Display_Name, Password) VALUES (?, ?, ?)", (username, display_name, hashed_password))
        conn.commit()
        return cursor.lastrowid

class AccountService(auth_pb2_grpc.AccountServiceServicer):
    def CreateAccount(self, request, context):
        try:
            if get_user_by_username(request.username):
                return auth_pb2.CreateAccountResponse(status=common_pb2.ResponseStatus.ACCOUNT_EXISTS)
            
            create_user(request.username, request.displayname, request.password)
            
            user_data = get_user_by_username(request.username)
            if not user_data:
                return auth_pb2.CreateAccountResponse(status=common_pb2.ResponseStatus.FAILURE)
            
            userid, user_name, display_name, _ = user_data
            user = common_pb2.User(userid=userid, username=user_name, displayname=display_name)
            
            contacts = [common_pb2.User(userid=u[0], username=u[1], displayname=u[2]) for u in get_all_users_except(request.username)]
            groups = [common_pb2.Group(groupid=u[0], groupname=u[1]) for u in get_all_groups(request.username)]
            return auth_pb2.CreateAccountResponse(
                status=common_pb2.ResponseStatus.SUCCESS,
                myself=user,
                contacts=contacts,
                url="/DashBoard",
                groups = groups
            )
            
        except Exception as e:
            print(f"Error creating account: {e}")
            return auth_pb2.CreateAccountResponse(status=common_pb2.ResponseStatus.FAILURE)

    def LoginAccount(self, request, context):
        try:
            user_data = get_user_by_username(request.username)
            if not user_data:
                return auth_pb2.LoginAccountResponse(status=common_pb2.ResponseStatus.ACCOUNT_NOT_FOUND)
            
            userid, user_name, display_name, hashed_password = user_data
            if not verify_password(request.password, hashed_password):
                return auth_pb2.LoginAccountResponse(status=common_pb2.ResponseStatus.UNAUTHORIZED)
            
            user = common_pb2.User(userid=userid, username=user_name, displayname=display_name)
            
            contacts = [common_pb2.User(userid=u[0], username=u[1], displayname=u[2]) for u in get_all_users_except(request.username)]
            groups = [common_pb2.Group(groupid=u[0], groupname=u[1]) for u in get_all_groups(request.username)]
            return auth_pb2.LoginAccountResponse(
                status=common_pb2.ResponseStatus.SUCCESS,
                myself=user,
                contacts=contacts,
                url="/DashBoard",
                groups = groups
            )
            
        except Exception as e:
            print(f"Error logging in: {e}")
            return auth_pb2.LoginAccountResponse(status=common_pb2.ResponseStatus.FAILURE)

def stop_server():
    global server 
    while True:
        x = input("Press 'q' and Enter to stop the server...\n")
        if x.lower() == 'q':
            break
    if server:
        print("Stopping server...")
        server.stop(0)  
    sys.exit(0)

def serve():
    global server 
    Path('DataBase').mkdir(exist_ok=True)
    initialize_database()
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    auth_pb2_grpc.add_AccountServiceServicer_to_server(AccountService(), server)
    server.add_insecure_port(SERVER_PORT)
    
    print(f"Server started on port {SERVER_PORT}")
    server.start()
    threading.Thread(target=stop_server, daemon=True).start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
