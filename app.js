require.config({
  paths: {
    vs: 'https://unpkg.com/monaco-editor@0.33.0/min/vs',
  },
});

require(['vs/editor/editor.main'], function () {
  // Initialize Monaco Editor
  const editor = monaco.editor.create(document.getElementById('editor'), {
    value: `// Welcome to Simple Intelligent IDE!\nconsole.log("Hello, World!");`,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
  });

  // Suggestion panel elements
  const suggestionPanel = document.getElementById('suggestion-panel');
  const suggestionContent = document.getElementById('suggestion-content');
  const suggestionSlider = document.getElementById('suggestion-slider');
  const applySuggestionButton = document.getElementById('apply-suggestion');
  const stopSuggestionButton = document.getElementById('stop-suggestion');
  const restartSuggestionsButton = document.getElementById('restart-suggestions-button');

  let originalCode = ''; // Store the original code
  let aiSuggestion = ''; // Store the AI's suggestion
  let isSuggestionsEnabled = true; // Flag to control AI suggestions

  // Function to get AI suggestions
  async function getAISuggestions(code) {
    if (!isSuggestionsEnabled) return; // Stop if suggestions are disabled

    const prompt = `Suggest improvements for the following code:\n${code}`;
    const response = await callGeminiAPI(prompt); // Replace with your AI API call
    return response;
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
      return `Failed to fetch suggestions: ${error.message}`;
    }
  }

  // Listen for changes in the editor with a 10-second delay
  editor.onDidChangeModelContent(async () => {
    if (!isSuggestionsEnabled) return; // Stop if suggestions are disabled

    const code = editor.getValue();

    // Clear any existing timeout to avoid multiple calls
    if (window.suggestionTimeout) {
      clearTimeout(window.suggestionTimeout);
    }

    // Set a 5-second delay before fetching suggestions
    window.suggestionTimeout = setTimeout(async () => {
      // Get AI suggestions
      aiSuggestion = await getAISuggestions(code);
      originalCode = code; // Store the original code

      // Display suggestions
      if (aiSuggestion) {
        suggestionContent.textContent = aiSuggestion;
        suggestionPanel.style.display = 'block';
      } else {
        suggestionPanel.style.display = 'none';
      }
    }, 5000); // 5-second delay
  });

  // Update the editor based on the slider value
  suggestionSlider.addEventListener('input', () => {
    const sliderValue = suggestionSlider.value / 100;

    // Blend the original code with the AI suggestion
    const blendedCode = blendCode(originalCode, aiSuggestion, sliderValue);
    editor.setValue(blendedCode);
  });

  // Function to blend two code snippets
  function blendCode(original, suggestion, ratio) {
    const originalLines = original.split('\n');
    const suggestionLines = suggestion.split('\n');

    // Blend each line
    const blendedLines = originalLines.map((line, index) => {
      const suggestionLine = suggestionLines[index] || '';
      return blendLine(line, suggestionLine, ratio);
    });

    return blendedLines.join('\n');
  }

  // Function to blend two lines of code
  function blendLine(originalLine, suggestionLine, ratio) {
    if (ratio === 0) return originalLine;
    if (ratio === 1) return suggestionLine;

    // Simple blending: choose one line based on the ratio
    return Math.random() < ratio ? suggestionLine : originalLine;
  }

  // Apply suggestion
  applySuggestionButton.addEventListener('click', () => {
    suggestionPanel.style.display = 'none'; // Hide the suggestion panel
  });

  // Stop suggestions
  stopSuggestionButton.addEventListener('click', () => {
    isSuggestionsEnabled = false; // Disable suggestions
    suggestionPanel.style.display = 'none'; // Hide the suggestion panel
    editor.setValue(originalCode); // Reset the editor to the original code
    appendToTerminal("🚫 AI suggestions stopped.");
    restartSuggestionsButton.style.display = 'block'; // Show the restart button
  });

  // Restart suggestions
  restartSuggestionsButton.addEventListener('click', () => {
    const confirmRestart = confirm("Do you want to restart AI suggestions?");
    if (confirmRestart) {
      isSuggestionsEnabled = true; // Re-enable suggestions
      restartSuggestionsButton.style.display = 'none'; // Hide the restart button
      appendToTerminal("🔄 AI suggestions restarted.");
    }
  });

  // Terminal output element
  const outputElement = document.getElementById('output');
  const terminalContainer = document.getElementById('terminal');

  // Scroll buttons
  const scrollUpButton = document.getElementById('scroll-up');
  const scrollDownButton = document.getElementById('scroll-down');

  // Function to scroll terminal up
  scrollUpButton.addEventListener('click', () => {
    terminalContainer.scrollBy({
      top: -50,
      behavior: 'smooth',
    });
  });

  // Function to scroll terminal down
  scrollDownButton.addEventListener('click', () => {
    terminalContainer.scrollBy({
      top: 50,
      behavior: 'smooth',
    });
  });

  // Function to append text to terminal
  function appendToTerminal(text) {
    // Convert URLs into clickable light blue links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const formattedText = text.replace(urlRegex, (url) =>
      `<a href="${url}" target="_blank" style="color: #4da6ff; text-decoration: underline;">${url}</a>`
    );

    // Append as HTML to allow links
    outputElement.innerHTML += formattedText + '<br>';
    outputElement.scrollTop = outputElement.scrollHeight; // Auto-scroll
  }

  // Function to clear terminal
  function clearTerminal() {
    outputElement.innerHTML = '';
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
        return `// Welcome to C++!\n#include <iostream>\nusing namespace std;\nint main() {\n    int num;\n    cout << "Enter a number: ";\n    cin >> num;\n    cout << "You entered: " << num << endl;\n    return 0;\n}`;
      case 'c':
        return `// Welcome to C!\n#include <stdio.h>\nint main() {\n    int num;\n    printf("Enter a number: ");\n    scanf("%d", &num);\n    printf("You entered: %d\\n", num);\n    return 0;\n}`;
      case 'java':
        return `// Welcome to Java!\nimport java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.print("Enter a number: ");\n        int num = scanner.nextInt();\n        System.out.println("You entered: " + num);\n    }\n}`;
      case 'javascript':
        return `// Welcome to Javascript!\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8'); // Read from stdin\nconsole.log(input)`;
      case 'typescript':
        return `// Welcome to Typescript!\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8'); // Read from stdin\nconsole.log(input)`;
      case 'html':
        return `<!-- Welcome to HTML! -->\n<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>`;
      case 'css':
        return `/* Welcome to CSS! */\nbody {\n  background-color: #1e1e1e;\n  color: #ffffff;\n}`;
      case 'nodejs':
        return `// Welcome to Node.js!\nconst http = require('http');\nconst server = http.createServer((req, res) => {\n  res.end('Hello, World!');\n});\nserver.listen(3000, () => {\n  console.log('Server running on port 3000');\n});`;
      case 'react':
        return `// Welcome to React!\nimport React from 'react';\nimport ReactDOM from 'react-dom';\n\nfunction App() {\n  return <h1>Hello, World!</h1>;\n}\n\nReactDOM.render(<App />, document.getElementById('root'));`;
      case 'angular':
        return `// Welcome to Angular!\nimport { Component } from '@angular/core';\n\n@Component({\n  selector: 'app-root',\n  template: '<h1>Hello, World!</h1>',\n})\nexport class AppComponent {}`;
      case 'vue':
        return `<!-- Welcome to Vue! -->\n<template>\n  <h1>Hello, World!</h1>\n</template>\n\n<script>\nexport default {\n  name: 'App',\n};\n</script>`;
      default:
        return `// Unsupported language`;
    }
  }

  // Run button functionality
  document.getElementById('run-test-button').addEventListener('click', async (event) => {
    event.preventDefault();
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    await runTest(code, language);
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

  // Run Test button functionality
  document.getElementById('run-test-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    const customInput = document.getElementById('custom-input').value;
    const expectedOutput = document.getElementById('expected-output').value;
    await runTest(code, language, customInput, expectedOutput);
  });

  // Deploy button functionality
  document.getElementById('deploy-button').addEventListener('click', async () => {
    clearTerminal();
    const code = editor.getValue();
    const language = languageSelect.value;
    appendToTerminal(`🚀 Deploying ${language} code...`);
    await deployCode(code, language);
  });

  let debounceTimeout;
  let htmlListenerAttached = false;
  function setupLivePreview() {
    if (htmlListenerAttached) return; // Avoid multiple bindings

    htmlListenerAttached = true;

    editor.onDidChangeModelContent(() => {
      const language = languageSelect.value;
      if (language !== "html") return; // Run only for HTML

      const code = editor.getValue();

      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        try {
          const previewResponse = await fetch("http://localhost:3000/preview/temp.html", { method: "HEAD" });
          if (previewResponse.ok) {

            await fetch("http://localhost:3000/live-server", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, language })
            });
          }
        } catch (error) {
          console.error("Live Server Error:", error);
        }
      }, 500); // Debounce for efficiency
    });
  }

  // Function to deploy code
  async function deployCode(code, language) {
    try {
      const response = await fetch('http://localhost:3000/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      const data = await response.json();
      if (data.url) {
        appendToTerminal(`✅ Deployment successful: ${data.url}`, 'terminal-success');
        setupLivePreview();
      } else {
        appendToTerminal(`❌ Deployment failed: ${data.error}`, 'terminal-failure');
      }
    } catch (error) {
      appendToTerminal(`⚠️ Failed to deploy: ${error.message}`, 'terminal-failure');
    }
  }

  // Function to debug code using AI
  async function debugCode(code, language) {
    const prompt = `Debug the following ${language} code and provide suggestions:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Debug] ${response}`);

    // Automatically apply fixes if user confirms
    const applyFix = confirm("Do you want to apply the suggested fixes?");
    if (applyFix) {
      const fixedCode = extractFixedCode(response);
      editor.setValue(fixedCode);
      appendToTerminal("✅ Fixes applied successfully.", 'terminal-success');
    }
  }

  // Function to extract fixed code from AI response
  function extractFixedCode(response) {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const matches = response.match(codeBlockRegex);
    if (matches) {
      return matches[0].replace(/```/g, "").trim();
    }
    return response;
  }

  // Function to check errors using AI
  async function checkErrors(code, language) {
    const prompt = `Check the following ${language} code for errors and provide fixes:\n${code}`;
    const response = await callGeminiAPI(prompt);
    appendToTerminal(`[Errors] ${response}`);
  }

  // Function to run test
  async function runTest(code, language, customInput, expectedOutput) {
    clearTerminal();
    const actualOutput = await RunInBackend(code, language, customInput);
    const isMatch = actualOutput.replace(/\r\n/g, '\n') === expectedOutput.replace(/\r\n/g, '\n');
    appendToTerminal(`[Test Result]`);
    appendToTerminal(`Actual Output:\n${actualOutput}`);
    appendToTerminal(`Expected Output:\n${expectedOutput}`);
    appendToTerminal(`Result: ${isMatch ? '✅' : '❌'}`, isMatch ? 'terminal-success' : 'terminal-failure');
  }

  // Function to execute code in the backend
  async function RunInBackend(code, language, input) {
    try {
      const response = await fetch('http://localhost:3000/execute-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language, input }),
      });

      const data = await response.json();
      if (data.output) {
        return data.output;
      } else if (data.error) {
        return data.error;
      } else {
        appendToTerminal('No output received.');
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
  aiSubmitButton.addEventListener('click', async (event) => {
    event.stopPropagation();
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
    }
  });

  // Copy generated code to clipboard
  aiCopyButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const code = aiGeneratedCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
      alert('Code copied to clipboard!');
    });
  });

  // Edit generated code
  aiEditButton.addEventListener('click', (event) => {
    event.stopPropagation();
    editor.setValue(aiGeneratedCode.textContent);
    aiSidebar.classList.remove('active');
  });

  // Function to create a new file
  document.getElementById('new-file-button').addEventListener('click', () => {
    const language = languageSelect.value;
    editor.setValue(getDefaultCode(language));
    appendToTerminal("🆕 New file created.");
  });

  // Function to save a file
  document.getElementById('save-file-button').addEventListener('click', () => {
    const code = editor.getValue();
    const language = languageSelect.value;
    const filename = prompt("Enter file name (with extension):", `file.${language}`);

    if (filename) {
      // Save file using the File System API (for local saving)
      const blob = new Blob([code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      appendToTerminal(`💾 File saved as ${filename}`);
    }
  });

  // Function to open a file
  document.getElementById('open-file-button').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.js,.py,.html,.css,.java,.cpp,.c,.ts,.jsx,.tsx';

    input.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          editor.setValue(content);

          // Detect language based on file extension
          const extension = file.name.split('.').pop();
          const languageMap = {
            js: 'javascript',
            py: 'python',
            html: 'html',
            css: 'css',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            ts: 'typescript',
            jsx: 'javascript',
            tsx: 'typescript',
          };
          const language = languageMap[extension] || 'text';
          languageSelect.value = language;
          monaco.editor.setModelLanguage(editor.getModel(), language);

          appendToTerminal(`📂 Opened file: ${file.name}`);
        };
        reader.readAsText(file);
      }
    };

    input.click();
  });

  // Toggle menu for mobile
  document.getElementById('menu-toggle').addEventListener('click', () => {
    const rightButtons = document.getElementById('right-buttons');
    rightButtons.classList.toggle('active');
  });

  // Close Button for AI Sidebar
  const aiCloseButton = document.getElementById('ai-close-button');
  aiCloseButton.addEventListener('click', () => {
    aiSidebar.classList.remove('active'); // Hide the sidebar
  });
  // Graph Mode and Visualization Logic
  const graphModeButton = document.getElementById('graph-mode-button');
  const visualizeButton = document.getElementById('visualize-button');
  const graphVisualizationContainer = document.getElementById('graph-visualization-container');
  const closeGraphVisualization = document.getElementById('close-graph-visualization');
  const graphInput = document.getElementById('graph-input');
  const generateGraphButton = document.getElementById('generate-graph');
  const graphCanvas = document.getElementById('graph-canvas');
  const ctx = graphCanvas.getContext('2d');

  // Drawing Canvas Logic
  const drawingContainer = document.getElementById('drawing-container');
  const closeDrawing = document.getElementById('close-drawing');
  const drawingCanvas = document.getElementById('drawing-canvas');
  const drawingCtx = drawingCanvas.getContext('2d');

  let isDrawing = false;
  let selectedColor = 'black'; // Default color

  // Color Picker Buttons
  const colorButtons = document.querySelectorAll('.color-button');
  colorButtons.forEach(button => {
    button.addEventListener('click', () => {
      selectedColor = button.getAttribute('data-color');
    });
  });

  // Show Drawing Canvas
  document.getElementById('drawing-button').addEventListener('click', () => {
    drawingContainer.style.display = 'block';
  });

  // Clear Canvas Button
  const clearCanvasButton = document.getElementById('clear-canvas');
  clearCanvasButton.addEventListener('click', () => {
    drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height); // Clear the canvas
  });

  // Close Drawing Canvas
  closeDrawing.addEventListener('click', () => {
    drawingContainer.style.display = 'none';
  });

  // Drawing on Canvas
  drawingCanvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    drawingCtx.beginPath();
    drawingCtx.moveTo(e.offsetX, e.offsetY);
    e.stopPropagation(); // Prevent container from moving
  });

  drawingCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
      drawingCtx.strokeStyle = selectedColor; // Set the selected color
      drawingCtx.lineTo(e.offsetX, e.offsetY);
      drawingCtx.stroke();
    }
  });

  drawingCanvas.addEventListener('mouseup', () => {
    isDrawing = false;
  });

  drawingCanvas.addEventListener('mouseleave', () => {
    isDrawing = false;
  });

  // Make the containers draggable
  function makeDraggable(element) {
    let isDragging = false;
    let offsetX, offsetY;

    element.addEventListener('mousedown', (e) => {
      if (e.target === drawingCanvas) return; // Prevent dragging if drawing on canvas
      isDragging = true;
      offsetX = e.clientX - element.getBoundingClientRect().left;
      offsetY = e.clientY - element.getBoundingClientRect().top;
    });

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('graph-visualization-container').style.display = 'none';
      document.getElementById('drawing-container').style.display = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        element.style.left = `${e.clientX - offsetX}px`;
        element.style.top = `${e.clientY - offsetY}px`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // makeDraggable(graphVisualizationContainer);
  makeDraggable(drawingContainer);

  let isGraphModeEnabled = false;
  // let isDrawing = false;

  // Toggle Graph Mode
  graphModeButton.addEventListener('click', () => {
    isGraphModeEnabled = !isGraphModeEnabled;
    graphModeButton.textContent = isGraphModeEnabled ? 'Disable Graph Mode' : 'Graph Mode';
    visualizeButton.style.display = isGraphModeEnabled ? 'block' : 'none';
  });

  // Show Graph Visualization Container
  visualizeButton.addEventListener('click', () => {
    graphVisualizationContainer.style.display = 'block';
  });

  // Close Graph Visualization Container
  closeGraphVisualization.addEventListener('click', () => {
    graphVisualizationContainer.style.display = 'none';
  });
  // Generate Graph/Tree
  generateGraphButton.addEventListener('click', () => {
    const input = graphInput.value.trim();
    const lines = input.split('\n');

    if (lines.length < 2) {
      alert('Please provide the number of nodes (n), edges (e), and the adjacency list.');
      return;
    }

    // Parse n and e
    const [n, e] = lines[0].split(' ').map(Number);
    if (isNaN(n) || isNaN(e) || lines.length - 1 !== e) {
      alert('Invalid input. Please provide the correct number of nodes, edges, and adjacency list.');
      return;
    }

    // Parse adjacency list
    const adjList = [];
    for (let i = 1; i <= e; i++) {
      const [u, v] = lines[i].split(' ').map(Number);
      if (isNaN(u) || isNaN(v)) {
        alert(`Invalid edge at line ${i + 1}.`);
        return;
      }
      adjList.push([u, v]);
    }

    // Clear canvas
    ctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);

    // Draw the graph
    drawGraph(n, adjList);
  });

  // Function to draw the graph
  function drawGraph(n, adjList) {
    const radius = 20; // Radius of nodes
    const padding = 50; // Padding around the canvas
    const nodePositions = [];

    // Calculate positions for nodes in a circular layout
    const angleStep = (2 * Math.PI) / n;
    const centerX = graphCanvas.width / 2;
    const centerY = graphCanvas.height / 2;
    const radiusLayout = Math.min(centerX, centerY) - padding;

    for (let i = 0; i < n; i++) {
      const angle = i * angleStep;
      const x = centerX + radiusLayout * Math.cos(angle);
      const y = centerY + radiusLayout * Math.sin(angle);
      nodePositions.push({ x, y });
    }

    // Draw edges
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    for (const [u, v] of adjList) {
      const uPos = nodePositions[u - 1];
      const vPos = nodePositions[v - 1];
      ctx.beginPath();
      ctx.moveTo(uPos.x, uPos.y);
      ctx.lineTo(vPos.x, vPos.y);
      ctx.stroke();
    }

    // Draw nodes
    ctx.fillStyle = 'blue';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const { x, y } = nodePositions[i];
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.fillText(i + 1, x, y);
      ctx.fillStyle = 'blue';
    }
  }

  // Make the graph visualization container draggable
  //makeDraggable(graphVisualizationContainer);

  makeDraggable(graphVisualizationContainer);
  // makeDraggable(drawingContainer);
});