const express = require('express');
const bodyParser = require('body-parser');
const { Telegraf } = require('telegraf');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));  // Добавляем это для обслуживания статических файлов

const server = http.createServer(app);
const io = socketIo(server);

let startedUsers = [];
let chatHistory = {};

bot.start((ctx) => {
    const userId = ctx.from.id;
    if (!startedUsers.includes(userId)) {
        startedUsers.push(userId);
        io.emit('newUser', userId);
    }
    ctx.reply('Добро пожаловать! Вы начали взаимодействие с ботом.');
});

bot.on('text', (ctx) => {
    const userId = ctx.from.id;
    const messageText = ctx.message.text;

    // Проверяем, начал ли пользователь чат
    if (!startedUsers.includes(userId)) {
        startedUsers.push(userId);
        io.emit('newUser', userId);
        ctx.reply('Добро пожаловать! Чем могу помочь?');
    }

    // Обрабатываем сообщение пользователя
    const message = { text: messageText, date: new Date(), sender: 'user' };

    if (!chatHistory[userId]) {
        chatHistory[userId] = [];
    }

    chatHistory[userId].push(message);
    io.emit('newMessage', { userId, message });
});


app.get('/startedUsers', (req, res) => {
    res.json({ startedUsers });
});

app.get('/chatHistory/:userId', (req, res) => {
    const userId = req.params.userId;
    const history = chatHistory[userId] || [];
    res.json({ chatHistory: history });
});

app.post('/sendMessage', (req, res) => {
    const { userId, text } = req.body;

    if (!userId || !text) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    bot.telegram.sendMessage(userId, text)
        .then(() => {
            const message = { text: text, date: new Date(), sender: 'operator' };

            if (!chatHistory[userId]) {
                chatHistory[userId] = [];
            }

            chatHistory[userId].push(message);
            io.emit('newMessage', { userId, message });

            res.json({ success: true });
        })
        .catch((err) => {
            console.error('Error sending message:', err);
            res.status(500).json({ error: 'Failed to send message' });
        });
});

app.post('/endChat', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    bot.telegram.sendMessage(userId, 'Чат завершен.')
        .then(() => {
            startedUsers = startedUsers.filter(id => id !== userId); // Удаляем пользователя из списка активных
            delete chatHistory[userId]; // Очищаем историю чата пользователя
            io.emit('chatEnded', userId);
            res.json({ success: true });
        })
        .catch((err) => {
            console.error('Error ending chat:', err);
            res.status(500).json({ error: 'Failed to end chat' });
        });
});

app.post('/clearChat', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    chatHistory[userId] = []; // Очищаем историю чата пользователя
    io.emit('chatCleared', userId);
    res.json({ success: true });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));  // Изменено для правильного пути к файлу
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

bot.launch().then(() => {
    console.log('Telegram bot is running');
});