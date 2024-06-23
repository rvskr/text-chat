$(document).ready(function() {
    const serverUrl = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
        ? 'http://localhost:3000' 
        : 'https://text-chat.onrender.com';

    const socket = io(serverUrl);

    function updateUsersList(users) {
        $('#userList').empty();
        users.forEach(function(userId) {
            $('#userList').append('<li class="list-group-item" data-user-id="' + userId + '">' + userId + '</li>');
        });
    }

    function updateChatHistory(history) {
        $('#chatMessages').empty();
        history.forEach(function(message) {
            const formattedDate = new Date(message.date).toLocaleString();
            const messageClass = message.sender === 'user' ? 'user-message' : 'bot-message';
            const messageText = $('<div>').text(message.text).html(); // Escape HTML entities

            $('#chatMessages').append('<div class="message ' + messageClass + '"><strong>' + formattedDate + '</strong>: ' + messageText + '</div>');
        });
    }

    socket.on('newUser', function(userId) {
        updateUsersList([...$('#userList li').map(function() { return $(this).data('user-id'); }), userId]);
    });

    socket.on('newMessage', function(data) {
        const userId = data.userId;
        const message = data.message;
        if ($('#userList li.active').data('user-id') === userId) {
            const formattedDate = new Date(message.date).toLocaleString();
            const messageClass = message.sender === 'user' ? 'user-message' : 'bot-message';
            const messageText = $('<div>').text(message.text).html(); // Escape HTML entities

            $('#chatMessages').append('<div class="message ' + messageClass + '"><strong>' + formattedDate + '</strong>: ' + messageText + '</div>');
        }
    });

    socket.on('chatEnded', function(userId) {
        alert('Чат с пользователем ' + userId + ' завершен.');
    });

    socket.on('chatCleared', function(userId) {
        $('#chatMessages').empty();
    });


    $(document).on('click', '#userList li', function() {
        const userId = $(this).data('user-id');
        $('#userList li').removeClass('active');
        $(this).addClass('active');
        loadChatHistory(userId);
    });


    function loadChatHistory(userId) {
        $.ajax({
            url: serverUrl + '/chatHistory/' + userId,
            method: 'GET',
            success: function(data) {
                updateChatHistory(data.chatHistory);
            },
            error: function(err) {
                console.error('Error loading chat history:', err);
            }
        });
    }

    $(document).on('submit', '#replyForm', function(event) {
        event.preventDefault();
        const userId = $('#userList li.active').data('user-id');
        const messageText = $('#messageText').val().trim();
        if (userId && messageText) {
            $.ajax({
                url: serverUrl + '/sendMessage',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId: userId, text: messageText }),
                success: function(response) {
                    console.log('Message sent successfully');
                    $('#messageText').val(''); // Очищаем поле ввода
                },
                error: function(err) {
                    console.error('Error sending message:', err);
                }
            });
        }
    });

    $(document).on('click', '#endChat', function() {
        const userId = $('#userList li.active').data('user-id');
        if (userId) {
            $.ajax({
                url: serverUrl + '/endChat',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId: userId }),
                success: function(response) {
                    console.log('Chat ended successfully');
                },
                error: function(err) {
                    console.error('Error ending chat:', err);
                }
            });
        }
    });

    $(document).on('click', '#clearChat', function() {
        const userId = $('#userList li.active').data('user-id');
        if (userId) {
            $.ajax({
                url: serverUrl + '/clearChat',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ userId: userId }),
                success: function(response) {
                    console.log('Chat cleared successfully');
                },
                error: function(err) {
                    console.error('Error clearing chat:', err);
                }
            });
        }
    });

    $.ajax({
        url: serverUrl + '/startedUsers',
        method: 'GET',
        success: function(data) {
            updateUsersList(data.startedUsers);
            if (data.startedUsers.length > 0) {
                const firstUserId = data.startedUsers[0];
                $('#userList li[data-user-id="' + firstUserId + '"]').addClass('active');
                loadChatHistory(firstUserId);
            }
        },
        error: function(err) {
            console.error('Error loading started users:', err);
        }
    });
});
