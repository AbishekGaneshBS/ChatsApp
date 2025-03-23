from concurrent import futures
import sqlite3
import grpc
import bcrypt
import createorlogin_pb2_grpc, createorlogin_pb2



def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def check_if_user_name_exists(username):
    try:
        conn = sqlite3.connect('DataBase/database.db')
        cursor = conn.cursor()
        cursor.execute("SELECT User_Name FROM Users WHERE User_Name = ?;", (username.strip(),))
        res = cursor.fetchone()
        conn.close()
        if res is not None and username in res:
            return True
        else:
            return False
    except Exception as e:
        print(f"Database error from checking: {e}")
        return False

class AccountService(createorlogin_pb2_grpc.AccountServiceServicer):
    def CreateAccount(self, request, context):
        print(request)
        if check_if_user_name_exists(request.user_name):
            return createorlogin_pb2.CreateAccountResponse(
                status=createorlogin_pb2.ResponseStatus.ACCOUNT_EXISTS
            )

        hashed_password = hash_password(request.password)

        try:
            conn = sqlite3.connect('DataBase/database.db')
            cursor = conn.cursor()
            
            cursor.execute(
                "INSERT INTO Users (User_Name, Display_Name, Password) VALUES (?, ?, ?);",
                (request.user_name, request.display_name, hashed_password)
            )
            conn.commit()

            cursor.execute("SELECT User_ID, User_Name, Display_Name FROM Users WHERE User_Name = ?;", (request.user_name,))
            user_data = cursor.fetchone()


            if user_data:
                cursor.execute("SELECT User_ID, User_Name, Display_Name FROM Users WHERE User_Name != ?;", (request.user_name,))
                all_users = cursor.fetchall()
                user_id, user_name, display_name = user_data
                user = createorlogin_pb2.User(user_id=user_id, user_name=user_name, display_name=display_name)

 
                contacts = [createorlogin_pb2.User(user_id=u[0], user_name=u[1], display_name=u[2]) for u in all_users]
                conn.close()
                return createorlogin_pb2.CreateAccountResponse(status=createorlogin_pb2.ResponseStatus.SUCCESS, myself=user, contacts=contacts, url=f"http://ChatsApp/Main")
            else:
                conn.close()
                return createorlogin_pb2.CreateAccountResponse(status=createorlogin_pb2.ResponseStatus.FAILURE)
        except Exception as e:
            print(f"Error creating account: {e}")
            conn.close()
            return createorlogin_pb2.CreateAccountResponse(status=createorlogin_pb2.ResponseStatus.FAILURE)

            

    def LoginAccount(self, request, context):
        if not check_if_user_name_exists(request.user_name):
            return createorlogin_pb2.LoginAccountResponse(
                status=createorlogin_pb2.ResponseStatus.ACCOUNT_NOT_FOUND
            )

        try:
            conn = sqlite3.connect('DataBase/database.db')
            cursor = conn.cursor()
            cursor.execute(
                "SELECT User_ID, User_Name, Display_Name, Password FROM Users WHERE User_Name = ?;",
                (request.user_name,)
            )
            user_data = cursor.fetchone()


            
           

            if user_data:
                cursor.execute("SELECT User_ID, User_Name, Display_Name FROM Users WHERE User_Name != ?;", (request.user_name,))
                all_users = cursor.fetchall()
                user_id, user_name, display_name, hashed_password = user_data

                if verify_password(request.password, hashed_password):
                    user = createorlogin_pb2.User(user_id=user_id, user_name=user_name, display_name=display_name)


                    contacts = [createorlogin_pb2.User(user_id=u[0], user_name=u[1], display_name=u[2]) for u in all_users]
                    conn.close()
                    return createorlogin_pb2.LoginAccountResponse(status=createorlogin_pb2.ResponseStatus.SUCCESS, myself=user, contacts=contacts, url=f"http://ChatsApp/Main")
                else:
                    conn.close()
                    return createorlogin_pb2.LoginAccountResponse(status=createorlogin_pb2.ResponseStatus.UNAUTHORIZED)
            else:
                conn.close()
                return createorlogin_pb2.LoginAccountResponse(status=createorlogin_pb2.ResponseStatus.FAILURE)
        except Exception as e:
            print(f"Error logging in: {e}")
            conn.close()
            return createorlogin_pb2.LoginAccountResponse(status=createorlogin_pb2.ResponseStatus.FAILURE)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    createorlogin_pb2_grpc.add_AccountServiceServicer_to_server(AccountService(), server)
    server.add_insecure_port('[::]:8000')
    print("Server started on port 8000.")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()