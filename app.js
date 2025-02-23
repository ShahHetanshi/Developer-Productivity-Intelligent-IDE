require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.33.0/min/vs' }});

require(['vs/editor/editor.main'], function() {
  // Initialize Monaco Editor
  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: `// Welcome to Simple Intelligent IDE!\nconsole.log("Hello, World!");`,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
  });

  // Terminal output element
  const outputElement = document.getElementById('output');

  // Function to clear terminal
  function clearTerminal() {
    outputElement.textContent = '';
  }

  // Function to append text to terminal
  function appendToTerminal(text) {
    outputElement.textContent += text + '\n';
    outputElement.scrollTop = outputElement.scrollHeight; // Auto-scroll
  }

  // Language selector
  const languageSelect = document.getElementById('language-select');
  languageSelect.addEventListener('change', () => {
    const language = languageSelect.value;
    editor.getModel().setValue(getDefaultCode(language));
    monaco.editor.setModelLanguage(editor.getModel(), language);
  });

  // Default code for each language
  function getDefaultCode(language) {
    switch (language) {
      case 'python':
        return `# Welcome to Python!\nname = input("Enter your name: ")\nprint("Hello, " + name)`;
      case 'cpp':
        return `// Welcome to C++!\n#include <iostream>\nusing namespace std;\nint main() {\n  int num;\n  cout << "Enter a number: ";\n  cin >> num;\n  cout << "You entered: " << num << endl;\n  return 0;\n}`;
      case 'c':
        return `// Welcome to C!\n#include <stdio.h>\nint main() {\n  int num;\n  printf("Enter a number: ");\n  scanf("%d", &num);\n  printf("You entered: %d\\n", num);\n  return 0;\n}`;
      case 'java':
        return `// Welcome to Java!\nimport java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner scanner = new Scanner(System.in);\n    System.out.print("Enter a number: ");\n    int num = scanner.nextInt();\n    System.out.println("You entered: " + num);\n  }\n}`;
      case 'javascript':
        return `// Welcome to Javascript!\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8'); // Read from stdin\nconsole.log(input)`;
      case 'typescript':
        return `// Welcome to Typescript!\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8'); // Read from stdin\nconsole.log(input)`;
      default:
        return `// Unsupported language`;
    }
  }

  // Run button functionality
  document.getElementById('run-button').addEventListener('click', async (event) => {
    event.preventDefault();
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    await RunInBackend(code, language);
  });

  // Debug button functionality
  document.getElementById('debug-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    await debugCode(code, language);
  });

  // Show Errors button functionality
  document.getElementById('show-errors-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    await checkErrors(code, language);
  });

  document.getElementById('run-test-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    const customInput = document.getElementById('custom-input').value;
    const expectedOutput = document.getElementById('expected-output').value;
    await runTest(code, language, customInput, expectedOutput);
  });

  // Function to debug code using Gemini API
  async function debugCode(code, language) {
    const prompt = `Debug the following ${language} code and provide suggestions:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Debug] ${response}`);
  }

  // Function to check errors using Gemini API
  async function checkErrors(code, language) {
    const prompt = `Check the following ${language} code for errors and provide fixes:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Errors] ${response}`);
  }

  // Function to run test using Server
  async function runTest(code, language, customInput, expectedOutput) {
    clearTerminal();
    
    // Trim whitespace and compare
    const actualOutput = await RunInBackend(code, language,customInput);
  
    // Check if the expected output is contained within the actual output
    const isMatch = actualOutput.replace(/\r\n/g, '\n') === expectedOutput.replace(/\r\n/g, '\n');

    // Display result with tick or cross
    appendToTerminal(`[Test Result]`);
    appendToTerminal(`Actual Output:\n${actualOutput}`);
    appendToTerminal(`Expected Output:\n${expectedOutput}`);
    appendToTerminal(`Result: ${isMatch ? '✅' : '❌'}`, isMatch ? 'terminal-success' : 'terminal-failure');
  }

  // Function to call Gemini API
  async function callGeminiAPI(prompt) {
    const apiKey = 'AIzaSyDoJxXE4EjKBYGj6q9JbwnTMBDR8WClFUc'; // Replace with your Gemini API key
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    try {
      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      return `Failed to fetch: ${error.message}`;
    }
  }

  async function RunInBackend(code, language, input) {
    // console.log("Running code in backend:", { code, language });
    try {
      const response = await fetch("http://localhost:3000/execute-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, input })
      });
  
      const data = await response.json();
      if (data.output) {
        return data.output;
      }
      else if(data.error) {
        return data.error;
      }
      else{
        appendToTerminal("No output received.");
      }
    } catch (error) {
      appendToTerminal(`⚠️ Failed to run code: ${error.message}`);
    }
  }

  // AI Code Generation Sidebar
  const aiSidebar = document.getElementById('ai-sidebar');
  const aiCodeButton = document.getElementById('ai-code-button');
  const aiSubmitButton = document.getElementById('ai-submit');
  const aiCopyButton = document.getElementById('ai-copy');
  const aiEditButton = document.getElementById('ai-edit');
  const aiPrompt = document.getElementById('ai-prompt');
  const aiGeneratedCode = document.getElementById('ai-generated-code');

  // Toggle sidebar visibility
  aiCodeButton.addEventListener('click', () => {
    aiSidebar.classList.toggle('active');
  });

  // Handle AI code generation
  aiSubmitButton.addEventListener('click', async () => {
    const prompt = aiPrompt.value;
    if (!prompt) {
      alert('Please enter a prompt.');
      return;
    }

    const language = languageSelect.value;
    const aiPromptText = `Generate ${language} code for: ${prompt}`;
    const generatedCode = await callGeminiAPI(aiPromptText);

    if (generatedCode) {
      aiGeneratedCode.textContent = generatedCode;
      aiSidebar.classList.remove('active');
    }
  });

  // Copy generated code to clipboard
  aiCopyButton.addEventListener('click', () => {
    const code = aiGeneratedCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      alert('Code copied to clipboard!');
    });
  });

  // Edit generated code
  aiEditButton.addEventListener('click', () => {
    editor.setValue(aiGeneratedCode.textContent);
    aiSidebar.classList.remove('active');
  });
});