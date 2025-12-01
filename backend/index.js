const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const chatRouter = require('./routes/chat');
const leadsRouter = require('./routes/leads');

app.use('/api/chat', chatRouter);
app.use('/api/leads', leadsRouter);

app.get('/', (req, res) => {
  res.send('ScriptishRx AI Concierge Backend is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
