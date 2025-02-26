const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const WebSocket = require('ws'); // Import WebSocket only once
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const htmlPreviewDir = tmp.dirSync({ unsafeCleanup: true }).name; // One-time temp directory
const htmlFilePath = path.join(htmlPreviewDir, 'temp.html'); // Static file path

// Serve the static HTML preview
app.use('/preview', express.static(htmlPreviewDir, { cacheControl: false }));

app.get('/api/key', (req, res) => {
    // console.log(-1);
    // console.log(process.env.GEMINI_API_KEY)
    res.json({ apiKey: process.env.GEMINI_API_KEY || '' });
});

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

const sessions = new Map(); // Store session data

wss.on('connection', (ws) => {
    console.log('New client connected');

    // Handle incoming messages from the client
    ws.on('message', (message) => {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);

        if (data.type === 'createSession') {
            const sessionId = data.sessionId;
            const name = data.name || "Anonymous"; // Default to "Anonymous" if no name is provided

            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, {
                    clients: new Map(), // Use a Map to store clients and names
                    code: data.code || '',
                    language: data.language || 'javascript',
                });

                sessions.get(sessionId).clients.set(ws, name);
                ws.sessionId = sessionId;
                ws.userName = name; // Store name in WebSocket

                console.log(`✅ Session created: ${sessionId} by ${name}`);

                ws.send(JSON.stringify({ type: 'sessionCreated', sessionId, name }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: '⚠️ Session already exists' }));
            }
        }

        // In server.js, modify the joinSession handler
        else if (data.type === 'joinSession') {
            const sessionId = data.sessionId;
            const name = data.name || "Anonymous"; // Default if no name is given

            if (sessions.has(sessionId)) {
                const session = sessions.get(sessionId);
                session.clients.set(ws, name); // Store client with name
                ws.sessionId = sessionId;
                ws.userName = name;

                console.log(`✅ ${name} joined session: ${sessionId}`);

                // Notify the joining user
                ws.send(JSON.stringify({ type: 'sessionJoined', sessionId, name }));

                // Notify other users in session
                session.clients.forEach((client, clientWs) => {
                    if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            type: 'userJoined',
                            sessionId,
                            name,
                            message: `${name} has joined the session.`
                        }));
                    }
                });

                // Send latest stored code and language
                ws.send(JSON.stringify({
                    type: 'codeUpdate',
                    code: session.code,
                    language: session.language
                }));
            } else {
                ws.send(JSON.stringify({ type: 'error', message: '❌ Session does not exist' }));
            }
        }

        else if (data.type === 'codeUpdate') {
            const sessionId = data.sessionId;
        
            if (sessions.has(sessionId)) {
                const session = sessions.get(sessionId);
                session.code = data.code;  // Store latest code
                session.language = data.language;  // Store latest language
        
                console.log(`📡 Broadcasting updated code in session: ${sessionId}`);
        
                // Broadcast to all clients in the session (except sender)
                session.clients.forEach((name, clientWs) => {
                    if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            type: 'codeUpdate',
                            code: data.code,
                            language: data.language
                        }));
                    }
                });
            } else {
                ws.send(JSON.stringify({ type: 'error', message: '❌ Session does not exist' }));
            }
        }        

        else if (data.type === 'leaveSession') {
            const sessionId = data.sessionId;

            if (sessions.has(sessionId)) {
                const session = sessions.get(sessionId);
                const name = session.clients.get(ws) || "A user";

                // Remove client from the session
                session.clients.delete(ws);
                console.log(`✅ ${name} left session: ${sessionId}`);

                // Notify the client that they left
                ws.send(JSON.stringify({ type: 'sessionLeft', sessionId, name }));

                // Notify remaining users
                session.clients.forEach((client, clientWs) => {
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            type: 'userLeft',
                            sessionId,
                            name,
                            message: `${name} has left the session.`
                        }));
                    }
                });

                // If no clients are left, delete the session
                if (session.clients.size === 0) {
                    sessions.delete(sessionId);
                    console.log(`🗑️ Session ${sessionId} deleted (no active clients).`);
                }

                delete ws.sessionId;
                delete ws.userName;
            } else {
                ws.send(JSON.stringify({ type: 'error', message: '❌ Session does not exist' }));
            }
        }

    });

    // Handle client disconnection
    ws.on('close', () => {
        if (ws.sessionId && sessions.has(ws.sessionId)) {
            const session = sessions.get(ws.sessionId);
            const name = session.clients.get(ws) || "A user";

            session.clients.delete(ws);
            console.log(`⚠️ ${name} disconnected from session: ${ws.sessionId}`);

            // Notify remaining clients
            session.clients.forEach((client, clientWs) => {
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({
                        type: 'userLeft',
                        sessionId: ws.sessionId,
                        name,
                        message: `${name} has disconnected.`
                    }));
                }
            });

            // Delete session if empty
            if (session.clients.size === 0) {
                sessions.delete(ws.sessionId);
                console.log(`🗑️ Session ${ws.sessionId} deleted (no active clients).`);
            }
        }
    });
});

console.log('WebSocket server is running on ws://localhost:8080');

// Existing routes for HTML preview and code execution
app.post('/deploy', async (req, res) => {
    const { code, language } = req.body;

    if (language !== "html") {
        return res.json({ error: "Live Server Not Supported For this language" });
    }

    fs.writeFileSync(htmlFilePath, code);

    return res.json({ url: `http://localhost:3000/preview/temp.html` });
});

app.post('/live-server', async (req, res) => {
    const { code, language } = req.body;
    if (language !== "html") {
        return res.json({ error: "Live Server Not Supported For this language" });
    }

    fs.writeFileSync(htmlFilePath, code);

    res.json({ success: true, message: "Live server updated!" });
});

app.post('/execute-code', (req, res) => {
    const { code, language, input } = req.body;
    let runCmd, args = [], tempFile, tempDir, compileCmd = null, executable = null;

    if (!code || !language) {
        return res.json({ error: "Code and language are required" });
    }

    // Direct execution for interpreted languages
    if (["python", "javascript", "typescript"].includes(language)) {
        switch (language) {
            case 'python':
                runCmd = 'python';
                args = ['-c', code];
                break;

            case 'javascript':
                runCmd = 'node';
                args = ['-e', code];
                break;

            case 'typescript':
                try {
                    // Create a temporary directory
                    const tempDirObj = tmp.dirSync({ unsafeCleanup: true });
                    const tempDir = tempDirObj.name;

                    // Define the path for the temporary TypeScript file
                    const tempFile = path.join(tempDir, 'temp.ts');

                    // Remove "export {}" if present in user code
                    const fixedCode = code.replace(/\bexport\s*{};/g, '');

                    // Write the corrected TypeScript code to the temporary file
                    fs.writeFileSync(tempFile, fixedCode);

                    // Spawn a child process to run the TypeScript code using ts-node
                    const childProcess = spawn('npx', ['ts-node', tempFile], {
                        shell: true,
                        env: { ...process.env, NODE_OPTIONS: '--loader ts-node/esm' }
                    });

                    // Handle input if provided
                    if (input) {
                        childProcess.stdin.write(input + '\n'); // Ensure newline for input
                        childProcess.stdin.end();
                    }

                    let output = '';
                    let errorOutput = '';

                    // Capture stdout and stderr
                    childProcess.stdout.on('data', (data) => output += data.toString());
                    childProcess.stderr.on('data', (data) => errorOutput += data.toString());

                    // Handle process close event
                    childProcess.on('close', (exitCode) => {
                        // Clean up the temporary directory
                        tempDirObj.removeCallback();

                        // Send the response based on the exit code
                        if (exitCode === 0) {
                            res.json({ output: output.trim() });
                        } else {
                            res.json({ error: errorOutput.trim() || "Runtime error" });
                        }
                    });

                    // Handle process error event
                    childProcess.on('error', (err) => {
                        tempDirObj.removeCallback();
                        res.status(500).json({ error: `Failed to start subprocess: ${err.message}` });
                    });

                } catch (err) {
                    // Handle any synchronous errors
                    res.status(500).json({ error: `An error occurred: ${err.message}` });
                }
                return;

            default:
                return res.json({ error: "Unsupported language" });
        }

        const process = spawn(runCmd, args);

        if (input) {
            process.stdin.write(input);
            process.stdin.end();
        }

        let output = "", errorOutput = "";
        process.stdout.on('data', (data) => output += data.toString());
        process.stderr.on('data', (data) => errorOutput += data.toString());

        process.on('close', (code) => {
            res.json(code === 0 ? { output: output.trim() } : { error: errorOutput.trim() || "Runtime error" });
        });
        return;
    }

    // Compiled languages need temporary file storage
    tempDir = tmp.dirSync({ unsafeCleanup: true }).name;

    switch (language) {
        case 'c':
            tempFile = path.join(tempDir, 'temp.c');
            executable = path.join(tempDir, os.platform() === "win32" ? 'temp.exe' : './temp.out');
            fs.writeFileSync(tempFile, code);
            compileCmd = `gcc ${tempFile} -o ${executable}`;
            runCmd = executable;
            break;

        case 'cpp':
            tempFile = path.join(tempDir, 'temp.cpp');
            executable = path.join(tempDir, os.platform() === "win32" ? 'temp.exe' : './temp.out');
            fs.writeFileSync(tempFile, code);
            compileCmd = `g++ ${tempFile} -o ${executable}`;
            runCmd = executable;
            break;

        case 'java':
            tempFile = path.join(tempDir, 'Main.java');
            fs.writeFileSync(tempFile, code);
            compileCmd = `javac ${tempFile}`;

            exec(compileCmd, (compileError, compileOutput, compileStderr) => {
                if (compileError) {
                    return res.json({ error: compileStderr || "Compilation error" });
                }

                const javaExecutable = 'java';
                const args = ['-cp', tempDir, 'Main'];

                const process = spawn(javaExecutable, args, { cwd: tempDir });

                if (input) {
                    process.stdin.write(input);
                    process.stdin.end();
                }

                let output = "", errorOutput = "";
                process.stdout.on('data', (data) => output += data.toString());
                process.stderr.on('data', (data) => errorOutput += data.toString());

                process.on('close', (code) => {
                    return res.json(code === 0 ? { output: output.trim() } : { error: errorOutput.trim() || "Runtime error" });
                });
            });
            return; // Prevent further execution

        default:
            return res.json({ error: "Unsupported language" });
    }

    // Compile the code first
    exec(compileCmd, (compileError, compileOutput, compileStderr) => {
        if (compileError) {
            return res.json({ error: compileStderr || "Compilation error" });
        }

        // Execute the compiled program
        const process = spawn(runCmd, [], { cwd: tempDir });

        if (input) {
            process.stdin.write(input);
            process.stdin.end();
        }

        let output = "", errorOutput = "";
        process.stdout.on('data', (data) => output += data.toString());
        process.stderr.on('data', (data) => errorOutput += data.toString());

        process.on('close', (code) => {
            res.json(code === 0 ? { output: output.trim() } : { error: errorOutput.trim() || "Runtime error" });
        });
    });
});

// Start the Express server
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
