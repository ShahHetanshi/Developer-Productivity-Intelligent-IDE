const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');
const os = require('os');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/execute-code', (req, res) => {
    const { code, language, input } = req.body;
    let filename, compileCmd, runCmd, outputFile, executable, inputFile;

    inputFile = 'input.txt';
    outputFile = 'output.txt';
    if (input) fs.writeFileSync(inputFile, input); // Save input to a file

    switch (language) {
        case 'python':
            filename = 'temp.py';
            fs.writeFileSync(filename, code);
            compileCmd = ``;
            runCmd = `python ${filename} < ${inputFile} > ${outputFile} 2>&1`;
            break;

        case 'cpp':
            filename = 'temp.cpp';
            executable = os.platform() === "win32" ? "temp.exe" : "./temp.out";
            fs.writeFileSync(filename, code);
            compileCmd = `g++ ${filename} -o ${executable} 2>${outputFile}`;
            runCmd = `${executable} < ${inputFile} > ${outputFile} 2>&1`;
            break;

        case 'c':
            filename = 'temp.c';
            executable = os.platform() === "win32" ? "temp.exe" : "./temp.out";
            fs.writeFileSync(filename, code);
            compileCmd = `gcc ${filename} -o ${executable} 2>${outputFile}`;
            runCmd = `${executable} < ${inputFile} > ${outputFile} 2>&1`;
            break;

        case 'java':
            filename = 'Main.java';
            fs.writeFileSync(filename, code);
            compileCmd = `javac ${filename} 2>${outputFile}`;
            runCmd = `java Main < ${inputFile} > ${outputFile} 2>&1`;
            break;

        case 'javascript':
            filename = 'temp.js';
            fs.writeFileSync(filename, code);
            compileCmd = ``;
            runCmd = `node ${filename} < ${inputFile} > ${outputFile} 2>&1`;
            break;

        case 'typescript':
            filename = 'temp.ts';
            fs.writeFileSync(filename, code);
            compileCmd = `tsc ${filename} --outFile temp.js 2>${outputFile}`;
            runCmd = `node temp.js < ${inputFile} > ${outputFile} 2>&1`;
            break;

        default:
            return res.json({ error: "Unsupported language" });
    }

    const executeCommand = (command, callback) => {
        exec(command, (error) => {
            const output = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, 'utf8').trim() : '';
            callback(error, output);
        });
    };

    if (compileCmd) {
        executeCommand(compileCmd, (compileError, compileOutput) => {
            if (compileError) {
                return res.json({ error: compileOutput || "Compilation error" });
            }

            executeCommand(runCmd, (runError, runOutput) => {
                if (runError) {
                    return res.json({ error: "Runtime error", output: runOutput });
                }
                return res.json({ output: runOutput });
            });
        });
    } else {
        executeCommand(runCmd, (runError, runOutput) => {
            if (runError) {
                return res.json({ error: "Runtime error", output: runOutput });
            }
            return res.json({ output: runOutput });
        });
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
