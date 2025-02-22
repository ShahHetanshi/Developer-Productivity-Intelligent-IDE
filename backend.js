const express = require('express');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/execute', (req, res) => {
  const { code, language, isDebug } = req.body;
  let command = '';

  switch (language) {
    case 'python':
      command = `python3 -c "${code}"`;
      break;
    case 'cpp':
      command = `echo '${code}' > temp.cpp && g++ temp.cpp -o temp && ./temp`;
      break;
    case 'c':
      command = `echo '${code}' > temp.c && gcc temp.c -o temp && ./temp`;
      break;
    case 'java':
      command = `echo '${code}' > Main.java && javac Main.java && java Main`;
      break;
    case 'javascript':
      command = `node -e "${code}"`;
      break;
    case 'typescript':
      command = `echo '${code}' > temp.ts && tsc temp.ts && node temp.js`;
      break;
    default:
      return res.status(400).json({ error: 'Unsupported language' });
  }

  exec(command, (error, stdout, stderr) => {
    if (error) {
      res.json({ error: stderr });
    } else {
      res.json({ output: stdout });
    }
  });
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});