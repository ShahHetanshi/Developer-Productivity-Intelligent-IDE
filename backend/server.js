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
                runCmd = 'ts-node';
                args = ['-e', code];
                break;
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
            runCmd = `${executable}`;
            break;

        case 'cpp':
            tempFile = path.join(tempDir, 'temp.cpp');
            executable = path.join(tempDir, os.platform() === "win32" ? 'temp.exe' : './temp.out');
            fs.writeFileSync(tempFile, code);
            compileCmd = `g++ ${tempFile} -o ${executable}`;
            runCmd = `${executable}`;
            break;

        case 'java':
            tempFile = path.join(tempDir, 'Main.java');
            fs.writeFileSync(tempFile, code);
            compileCmd = `javac ${tempFile}`;
            runCmd = `java -cp ${tempDir} Main`;
            break;

        default:
            return res.json({ error: "Unsupported language" });
    }

    // Compile the code first
    exec(compileCmd, (compileError, compileOutput, compileStderr) => {
        if (compileError) {
            return res.json({ error: compileStderr || "Compilation error" });
        }

        // Execute the compiled program
        const process = spawn(runCmd, { cwd: tempDir });

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
