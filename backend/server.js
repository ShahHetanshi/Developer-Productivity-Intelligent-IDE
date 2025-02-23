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

// Endpoint to execute code
app.post('/execute-code', (req, res) => {
    const { code, language, input } = req.body;
    let runCmd, args = [], tempFile, tempDir, compileCmd = null, executable = null;

    // Validate input
    if (!code || !language) {
        return res.status(400).json({ error: "Code and language are required" });
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
                return res.status(400).json({ error: "Unsupported language" });
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
            return res.status(400).json({ error: "Unsupported language" });
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

// Start the server
app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});