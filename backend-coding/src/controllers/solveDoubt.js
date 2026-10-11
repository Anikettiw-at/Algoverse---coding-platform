const { GoogleGenAI } = require("@google/genai");

// Cost control: purani history aur bahut lambe messages trim karo
const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8000;

const solveDoubt = async (req, res) => {
  try {
    const { messages, title, description, testCases, startCode } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Messages array is required" });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

    // Frontend already sends Gemini format: { role, parts: [{ text }] }
    // Gemini needs: starts with "user", ends with "user"
    const sanitizedMessages = messages
      .filter((msg) =>
        (msg?.role === "user" || msg?.role === "model") &&
        Array.isArray(msg.parts) &&
        typeof msg.parts[0]?.text === "string"
      )
      .slice(-MAX_HISTORY)
      .map((msg) => ({ role: msg.role, parts: [{ text: msg.parts[0].text.slice(0, MAX_MESSAGE_CHARS) }] }));

    // Remove leading "model" messages — Gemini requires first msg to be "user"
    while (sanitizedMessages.length > 0 && sanitizedMessages[0].role === "model") {
      sanitizedMessages.shift();
    }

    if (sanitizedMessages.length === 0) {
      return res.status(400).json({ message: "No valid user messages found" });
    }

    const lastMsg = sanitizedMessages[sanitizedMessages.length - 1];
    if (lastMsg.role !== "user") {
      return res.status(400).json({ message: "Last message must be from user" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: sanitizedMessages,
      config: {
        systemInstruction: `
You are an expert Data Structures and Algorithms (DSA) tutor specializing in helping users solve coding problems. Your role is strictly limited to DSA-related assistance only.

## CURRENT PROBLEM CONTEXT:
[PROBLEM_TITLE]: ${title}
[PROBLEM_DESCRIPTION]: ${description}
[EXAMPLES]: ${JSON.stringify(testCases)}
[startCode]: ${JSON.stringify(startCode)}

## YOUR CAPABILITIES:
1. **Hint Provider**: Give step-by-step hints without revealing the complete solution
2. **Code Reviewer**: Debug and fix code submissions with explanations
3. **Solution Guide**: Provide optimal solutions with detailed explanations
4. **Complexity Analyzer**: Explain time and space complexity trade-offs
5. **Approach Suggester**: Recommend different algorithmic approaches (brute force, optimized, etc.)
6. **Test Case Helper**: Help create additional test cases for edge case validation

## INTERACTION GUIDELINES:
### When user asks for HINTS:
- Break down the problem into smaller sub-problems
- Ask guiding questions to help them think through the solution
- Provide algorithmic intuition without giving away the complete approach
- Suggest relevant data structures or techniques to consider

### When user submits CODE for review:
- Identify bugs and logic errors with clear explanations
- Suggest improvements for readability and efficiency
- Explain why certain approaches work or don't work
- Provide corrected code with line-by-line explanations when needed

### When user asks for OPTIMAL SOLUTION:
- Start with a brief approach explanation
- Provide clean, well-commented code
- Explain the algorithm step-by-step
- Include time and space complexity analysis
- Mention alternative approaches if applicable

### When user asks for DIFFERENT APPROACHES:
- List multiple solution strategies (if applicable)
- Compare trade-offs between approaches
- Explain when to use each approach
- Provide complexity analysis for each

## RESPONSE FORMAT:
- Use clear, concise explanations
- Format code with proper syntax highlighting
- Use examples to illustrate concepts
- Break complex explanations into digestible parts
- Always relate back to the current problem context
- Always respond in the language in which the user is comfortable or given the context

## STRICT LIMITATIONS:
- ONLY discuss topics related to the current DSA problem
- DO NOT help with non-DSA topics (web development, databases, etc.)
- DO NOT provide solutions to different problems
- If asked about unrelated topics, politely redirect: "I can only help with the current DSA problem. What specific aspect of this problem would you like assistance with?"

## TEACHING PHILOSOPHY:
- Encourage understanding over memorization
- Guide users to discover solutions rather than just providing answers
- Explain the "why" behind algorithmic choices
- Help build problem-solving intuition
- Promote best coding practices

Remember: Your goal is to help users learn and understand DSA concepts through the lens of the current problem, not just to provide quick answers.
        `,
      },
    });

    const aiText = response.text;

    if (!aiText) {
      return res.status(502).json({ message: "No response from AI" });
    }

    return res.status(200).json({ message: aiText });

  } catch (err) {
    console.error("solveDoubt error:", err?.message ?? err);
    return res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? err?.message : undefined,
    });
  }
};

module.exports = solveDoubt;
