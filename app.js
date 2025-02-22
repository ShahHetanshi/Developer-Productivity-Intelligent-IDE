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
        return `// Welcome to JavaScript!\nconst name = prompt("Enter your name:");\nconsole.log("Hello, " + name);`;
      case 'typescript':
        return `// Welcome to TypeScript!\nconst name: string | null = prompt("Enter your name:");\nconsole.log("Hello, " + name);`;
      default:
        return `// Unsupported language`;
    }
  }

  // Run button functionality
  document.getElementById('run-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    await executeCode(code, language);
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

  // Function to execute code using Gemini API
  async function executeCode(code, language) {
    const prompt = `Execute the following ${language} code and provide the output. If the code requires user input, simulate it:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(response);
  }

  // Function to debug code using Gemini API
  async function debugCode(code, language) {
    const prompt = `Debug the following ${language} code and provide suggestions:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Debug] ${response}`);
  }

  // Function to check for errors using Gemini API
  async function checkErrors(code, language) {
    const prompt = `Check the following ${language} code for errors and provide fixes:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Errors] ${response}`);
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
          contents: [{
            parts: [{
              text: prompt,
            }],
          }],
        }),
      });
      const data = await response.json();
      return data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      return `Failed to fetch: ${error.message}`;
    }
  }

  // Function to simulate user input
  async function getUserInput(prompt) {
    return new Promise((resolve) => {
      const input = window.prompt(prompt);
      resolve(input);
    });
  }
});