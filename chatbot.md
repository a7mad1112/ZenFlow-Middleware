### 🤖 AI Ops-Assistant (RAG System) Implementation Roadmap

This roadmap outlines the technical architecture for integrating a **Retrieval-Augmented Generation** chatbot into the ZenFlow Dashboard. This will allow users to query real-time execution data using natural language.

---

## 🏗️ Technical Architecture

### 1. Data Retrieval Layer (The "R" in RAG)
Instead of training a model, we provide "Live Context" from the database.
* **Context Fetcher:** A specialized service to query the last 20-30 `TaskLogs`, including:
    * `status` (Success/Failed)
    * `aiSummary` (Gemini's previous insights)
    * `error` messages (Stack traces/reasons)
    * `pipeline` configurations (Enabled/Disabled actions)
* **Metadata Injector:** Pulls system stats (Success rate, active workers) to provide high-level overviews.

### 2. Prompt Engineering (The Context Bridge)
We construct a "Dynamic System Prompt" for Gemini:
> **Role:** You are the "ZenFlow Ops Assistant," a senior site reliability engineer.
> **Context:** Here is the current state of the system: `[JSON_DATA_FROM_DB]`
> **User Question:** `[USER_QUERY]`
> **Constraint:** Answer based ONLY on the provided context. If data is missing, say "I don't have enough logs to answer that."

### 3. API Execution (The Brain)
* **Endpoint:** `POST /api/ai/chat`
* **Controller:** 1. Receive user message.
    2. Execute `Data Fetcher` to get the latest JSON snapshot.
    3. Call `GoogleGenerativeAI` with the combined Prompt + Context.
    4. Return the intelligent response.

---

## 🛠️ Implementation Steps

### Phase 1: Backend Intelligence
- [ ] **Service:** Create `src/services/ai-assistant.service.ts`.
- [ ] **Logic:** Implement a "Snapshot" function that converts recent DB logs into a readable text summary for the AI.
- [ ] **Route:** Set up the Express route and controller for `/api/ai/chat`.

### Phase 2: Frontend Experience
- [ ] **Component:** Create a floating `ChatWidget.tsx` using TailwindCSS.
- [ ] **State Management:** Use `useState` to track the conversation history (User vs. Bot).
- [ ] **Interaction:** Add "Quick Actions" like:
    * *"Why did my last task fail?"*
    * *"Summarize today's risk report."*
    * *"Is the Email service healthy?"*

### Phase 3: RAG Hardening
- [ ] **Token Optimization:** Ensure the JSON context isn't too large for the Gemini window.
- [ ] **Security:** Mask sensitive data (like `customer.email` or `passwords`) before sending context to the AI.

---

## 📈 Example Use Cases
| User Query | RAG Behavior |
| :--- | :--- |
| **"What's wrong with the Discord pipeline?"** | Bot sees `discord: { status: 'failed' }` in logs and explains the webhook URL might be expired. |
| **"Are there any VIP customers today?"** | Bot scans `aiSummary` fields for "VIP verified" tags and lists the order IDs. |
| **"Should I be worried about failures?"** | Bot calculates the failure percentage from the context and gives a "Health Score." |
