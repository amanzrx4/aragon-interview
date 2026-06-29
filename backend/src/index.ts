import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello World from Backend!' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
