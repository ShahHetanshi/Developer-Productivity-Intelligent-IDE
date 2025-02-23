const express = require('express');
const { spawn, exec } = require('child_process');
const cors = require('cors');
const bodyParser = require('body-parser');
const os = require('os');
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const htmlPreviewDir = tmp.dirSync({ unsafeCleanup: true }).name; // One-time temp directory
const htmlFilePath = path.join(htmlPreviewDir, 'temp.html'); // Static file path

// Serve the static HTML preview
app.use('/preview', express.static(htmlPreviewDir, { cacheControl: false }));

app.post('/deploy',async (req,res)=>{
    const { code, language } = req.body;

    if(language!=="html"){
        return res.json({ error: "Live Server Not Supported For this language"});
    }

    fs.writeFileSync(htmlFilePath, code);

    return res.json({ url: `http://localhost:3000/preview/temp.html` });
});

app.post('/live-server',async (req,res)=>{
    const { code, language } = req.body;
    if(language!=="html"){
        return res.json({ error: "Live Server Not Supported For this language"});
    }
    
    fs.writeFileSync(htmlFilePath, code);

    res.json({ success: true, message: "Live server updated!" });
});

app.post('/proxy/ollama', async (req, res) => {
    try {
        const { model, prompt, stream } = req.body;

        // Forward the request to Ollama API
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, prompt, stream })
        });

        // Check if the Ollama API request was successful
        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API request failed with status ${ollamaResponse.status}`);
        }

        // Parse the Ollama API response
        const data = await ollamaResponse.json();

        // Send the response back to the frontend
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: `Proxy error: ${error.message}` });
    }
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

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});