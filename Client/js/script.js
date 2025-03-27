        // Sample contacts data
        const contacts = [
            { id: 1, name: "John Doe", avatar: "JD", lastMessage: "Hey, how are you doing?", time: "12:30 PM", online: true },
            { id: 2, name: "Alice Smith", avatar: "AS", lastMessage: "Meeting at 3 PM tomorrow", time: "11:45 AM", online: false },
            { id: 3, name: "Bob Johnson", avatar: "BJ", lastMessage: "Did you see the news?", time: "10:20 AM", online: true },
            { id: 4, name: "Emma Wilson", avatar: "EW", lastMessage: "Thanks for your help!", time: "Yesterday", online: false },
            { id: 5, name: "Team Jira", avatar: "TJ", lastMessage: "New ticket assigned to you", time: "Yesterday", online: false }
        ];

        // Sample messages for each contact
        const messages = {
            1: [
                { text: "Hey there! How are you?", time: "12:30 PM", sent: false },
                { text: "I'm doing great! Just working on some projects.", time: "12:32 PM", sent: true },
                { text: "That sounds interesting. What kind of projects?", time: "12:33 PM", sent: false },
                { text: "Building a WhatsApp UI clone with HTML/CSS.", time: "12:35 PM", sent: true },
                { text: "Nice! Can you send me the code when you're done?", time: "12:36 PM", sent: false }
            ],
            2: [
                { text: "Hi Alice, about tomorrow's meeting", time: "11:40 AM", sent: true },
                { text: "Yes, what about it?", time: "11:42 AM", sent: false },
                { text: "Can we move it to 3 PM instead of 2?", time: "11:43 AM", sent: true },
                { text: "Meeting at 3 PM tomorrow works for me", time: "11:45 AM", sent: false }
            ],
            3: [
                { text: "Did you see the news about the new tech launch?", time: "10:20 AM", sent: false }
            ],
            4: [
                { text: "I fixed that bug you reported", time: "Yesterday", sent: true },
                { text: "Thanks for your help!", time: "Yesterday", sent: false }
            ],
            5: [
                { text: "New ticket assigned to you: UI improvements", time: "Yesterday", sent: false }
            ]
        };

        // DOM elements
        const chatList = document.getElementById('chatList');
        const noChatSelected = document.getElementById('noChatSelected');
        const activeChat = document.getElementById('activeChat');
        const messagesContainer = document.getElementById('messagesContainer');
        const currentChatName = document.getElementById('currentChatName');
        const currentChatAvatar = document.getElementById('currentChatAvatar');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');

        // Current active chat ID
        let activeChatId = null;

        // Initialize the chat list
        function initChatList() {
            chatList.innerHTML = '';
            contacts.forEach(contact => {
                const chatItem = document.createElement('div');
                chatItem.className = 'chat-item';
                chatItem.dataset.id = contact.id;
                
                chatItem.innerHTML = `
                    <div class="chat-avatar">${contact.avatar}</div>
                    <div class="chat-info">
                        <div class="chat-name-time">
                            <span class="chat-name">${contact.name}</span>
                            <span class="chat-time">${contact.time}</span>
                        </div>
                        <div class="chat-preview">
                            <span class="chat-message">${contact.lastMessage}</span>
                        </div>
                    </div>
                `;
                
                chatItem.addEventListener('click', () => switchChat(contact.id));
                chatList.appendChild(chatItem);
            });
        }

        // Switch to a different chat
        function switchChat(contactId) {
            activeChatId = contactId;
            
            // Update active state in chat list
            document.querySelectorAll('.chat-item').forEach(item => {
                item.classList.toggle('active', item.dataset.id == contactId);
            });
            
            // Find the contact
            const contact = contacts.find(c => c.id == contactId);
            if (!contact) return;
            
            // Update chat header
            currentChatName.textContent = contact.name;
            currentChatAvatar.textContent = contact.avatar;
            
            // Load messages
            loadMessages(contactId);
            
            // Show active chat
            noChatSelected.style.display = 'none';
            activeChat.style.display = 'flex';
            
            // Scroll to bottom of messages
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }

        // Load messages for a contact
        function loadMessages(contactId) {
            messagesContainer.innerHTML = '';
            
            const contactMessages = messages[contactId] || [];
            
            contactMessages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.sent ? 'sent' : 'received'}`;
                messageDiv.innerHTML = `
                    ${msg.text}
                    <div class="message-time">${msg.time}</div>
                `;
                messagesContainer.appendChild(messageDiv);
            });
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Send a new message
        function sendMessage() {
            const text = messageInput.value.trim();
            if (!text || !activeChatId) return;
            
            // Create new message object
            const now = new Date();
            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const newMessage = {
                text: text,
                time: time,
                sent: true
            };
            
            // Add to messages
            if (!messages[activeChatId]) {
                messages[activeChatId] = [];
            }
            messages[activeChatId].push(newMessage);
            
            // Update UI
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message sent';
            messageDiv.innerHTML = `
                ${text}
                <div class="message-time">${time}</div>
            `;
            messagesContainer.appendChild(messageDiv);
            
            // Clear input
            messageInput.value = '';
            
            // Update last message in contact list
            updateLastMessage(activeChatId, text, time);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Simulate reply after 1-3 seconds
            setTimeout(() => {
                simulateReply(activeChatId);
            }, 1000 + Math.random() * 2000);
        }

        // Update last message in contact list
        function updateLastMessage(contactId, message, time) {
            const contactItem = document.querySelector(`.chat-item[data-id="${contactId}"]`);
            if (contactItem) {
                const messageEl = contactItem.querySelector('.chat-message');
                const timeEl = contactItem.querySelector('.chat-time');
                
                if (messageEl) messageEl.textContent = message;
                if (timeEl) timeEl.textContent = time;
            }
        }

        // Simulate a reply from the contact
        function simulateReply(contactId) {
            if (!activeChatId || activeChatId != contactId) return;
            
            const replies = [
                "Sounds good!",
                "I'll get back to you on that",
                "Thanks for letting me know",
                "Can we talk about this later?",
                "Interesting, tell me more",
                "👍",
                "Got it!"
            ];
            
            const replyText = replies[Math.floor(Math.random() * replies.length)];
            const now = new Date();
            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const replyMessage = {
                text: replyText,
                time: time,
                sent: false
            };
            
            messages[contactId].push(replyMessage);
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message received';
            messageDiv.innerHTML = `
                ${replyText}
                <div class="message-time">${time}</div>
            `;
            messagesContainer.appendChild(messageDiv);
            
            // Update last message in contact list
            updateLastMessage(contactId, replyText, time);
            
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Event listeners
        sendButton.addEventListener('click', sendMessage);
        
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-resize textarea
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });

        // Initialize the app
        initChatList();