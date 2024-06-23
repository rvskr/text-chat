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
app.use(express.static(path.join(__dirname)));

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

    if (!startedUsers.includes(userId)) {
        startedUsers.push(userId);
        io.emit('newUser', userId);
        ctx.reply('Добро пожаловать! Чем могу помочь?');
    }

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
            startedUsers = startedUsers.filter(id => id !== userId);
            delete chatHistory[userId];
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

    chatHistory[userId] = [];
    io.emit('chatCleared', userId);
    res.json({ success: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Установка интервала для выполнения задачи
    const interval = 15 * 60 * 1000; // 15 минут в миллисекундах

    if (process.env.RENDER) {
        // Если мы на render.com, используем публичный URL приложения на render.com
        const PUBLIC_URL = 'https://text-chat.onrender.com/'; // Замените на реальный публичный URL вашего приложения на render.com
        setInterval(() => {
            const url = `${PUBLIC_URL}/startedUsers`;
            http.get(url, (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    console.log('Scheduled task executed successfully');
                });
            }).on('error', (err) => {
                console.error('Error executing scheduled task:', err);
            });
        }, interval);
    } else {
        // Иначе, если мы локально, используем localhost
        setInterval(() => {
            const url = `http://localhost:${PORT}/startedUsers`;
            http.get(url, (resp) => {
                let data = '';
                resp.on('data', (chunk) => {
                    data += chunk;
                });
                resp.on('end', () => {
                    console.log('Scheduled task executed successfully');
                });
            }).on('error', (err) => {
                console.error('Error executing scheduled task:', err);
            });
        }, interval);
    }
});

bot.launch().then(() => {
    console.log('Telegram bot is running');
});
