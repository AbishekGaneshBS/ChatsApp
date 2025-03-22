from concurrent import futures
from datetime import datetime
import sqlite3
import time
import grpc
import bcrypt
import createorlogin_pb2_grpc, createorlogin_pb2


def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(plain_password, hashed_password):
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def check_if_user_name_exists(username):
    try:
        conn = sqlite3.connect('../Database/database.db')
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM Users WHERE User_Name = ?;", (username.strip(),))
        res = cursor.fetchone()
        conn.close()
        if res is None:
            return 0
        else:
            return 3
    except:
        return 1


class CreateAccountService(createorlogin_pb2_grpc.AccountServiceServicer):
    def CreateAccount(self, request, content):
        response = check_if_user_name_exists(request.user_name)
        if response == 0:
            try:
                hashed_password = hash_password(request.password)
                conn = sqlite3.connect('../Database/database.db')
                cursor = conn.cursor()
                cursor.execute("INSERT INTO Users (User_Name, Display_Name, Password) VALUES (?, ?)", (request.user_name, request.display_name, hashed_password))
                conn.commit()
            except:
                response = 1
            finally:
                conn.close()
            
        

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    createorlogin_pb2_grpc.add_AccountServiceServicer_to_server(CreateAccountService(), server)
    #createorlogin_pb2_grpc.add_AccountServiceServicer_to_server(LoginService(), server)

    server.add_insecure_port('[::]:8000')
    server.start()
    print("Server started on port 8000.")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()