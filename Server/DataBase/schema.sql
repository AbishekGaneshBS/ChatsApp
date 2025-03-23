
PRAGMA foreign_keys = ON;


CREATE TABLE Users (
    User_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    User_Name TEXT NOT NULL UNIQUE,
    Display_Name TEXT NOT NULL,
    Password TEXT NOT NULL, 
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE UserToUserMessages (
    Message_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Sender_ID INTEGER NOT NULL,  
    Receiver_ID INTEGER NOT NULL, 
    Message TEXT NOT NULL,
    Sent_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Is_Read INTEGER DEFAULT 0,  
    FOREIGN KEY (Sender_ID) REFERENCES Users(User_ID),
    FOREIGN KEY (Receiver_ID) REFERENCES Users(User_ID)
);


CREATE TABLE Groups (
    Group_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Group_Name TEXT NOT NULL,
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE GroupMembers (
    Group_ID INTEGER NOT NULL,
    User_ID INTEGER NOT NULL,
    Joined_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Group_ID) REFERENCES Groups(Group_ID),
    FOREIGN KEY (User_ID) REFERENCES Users(User_ID),
    UNIQUE (Group_ID, User_ID)  
);


CREATE TABLE GroupMessages (
    Message_ID INTEGER PRIMARY KEY AUTOINCREMENT,
    Group_ID INTEGER NOT NULL,
    Sender_ID INTEGER NOT NULL,
    Message TEXT NOT NULL,
    Sent_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Group_ID) REFERENCES Groups(Group_ID),
    FOREIGN KEY (Sender_ID) REFERENCES Users(User_ID)
);


CREATE INDEX idx_sender_receiver ON UserToUserMessages (Sender_ID, Receiver_ID);
CREATE INDEX idx_receiver_sender ON UserToUserMessages (Receiver_ID, Sender_ID);
CREATE INDEX idx_receiver_is_read ON UserToUserMessages (Receiver_ID, Is_Read);
CREATE INDEX idx_sender_receiver_is_read ON UserToUserMessages (Sender_ID, Receiver_ID, Is_Read);
CREATE INDEX idx_receiver_sender_is_read ON UserToUserMessages (Receiver_ID, Sender_ID, Is_Read);


CREATE INDEX idx_group_id ON GroupMessages (Group_ID);
CREATE INDEX idx_sender_id ON GroupMessages (Sender_ID);
CREATE INDEX idx_group_sender ON GroupMessages (Group_ID, Sender_ID);