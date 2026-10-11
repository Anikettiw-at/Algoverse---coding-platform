import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import axiosClient from "../utils/axiosClient";
import { Send } from "lucide-react";

function ChatAi({ problem }) {
  // Empty array — no fake messages, model greeting sirf UI mein dikhega
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSubmit = async (data) => {
    const userMessage = { role: "user", parts: [{ text: data.message }] };

    // Fix Bug 2: updated array banao aur same use karo API call mein
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    reset();
    setIsLoading(true);

    try {
      const response = await axiosClient.post("/ai/chat", {
        messages: updatedMessages, // ← stale messages nahi, fresh array
        title: problem.title,
        description: problem.description,
        testCases: problem.visibleTestCases,
        startCode: problem.startCode,
      });

      setMessages((prev) => [
        ...prev,
        { role: "model", parts: [{ text: response.data.message }] },
      ]);
    } catch (error) {
      console.error("API Error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "model", parts: [{ text: "Sorry, something went wrong. Please try again." }] },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-[80vh] min-h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Greeting — sirf UI mein, messages array mein nahi */}
        <div className="chat chat-start">
          <div className="chat-bubble bg-base-200 text-base-content">
            👋 Hi! I'm your DSA tutor. Ask me anything about <strong>{problem?.title}</strong>.
          </div>
        </div>

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
          >
            <div className="chat-bubble bg-base-200 text-base-content whitespace-pre-wrap">
              {msg.parts[0].text}
            </div>
          </div>
        ))}

        {/* Loading bubble */}
        {isLoading && (
          <div className="chat chat-start">
            <div className="chat-bubble bg-base-200 text-base-content">
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="sticky bottom-0 p-4 bg-base-100 border-t"
      >
        <div className="flex items-center gap-2">
          <input
            placeholder="Ask me anything about this problem..."
            className="input input-bordered flex-1"
            disabled={isLoading}
            {...register("message", { required: true, minLength: 2 })}
          />
          <button
            type="submit"
            className="btn btn-ghost"
            disabled={!!errors.message || isLoading}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatAi;
