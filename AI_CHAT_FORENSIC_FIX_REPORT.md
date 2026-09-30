# NeuroCare AI Chatbot Conversational Intent Forensic Fix Report

## Executive Summary
This document details the root cause analysis, architectural fixes, and verified test results for the NeuroCare AI Assistant conversational intent bug. The chatbot has been upgraded to a true context-aware conversational assistant that dynamically recognizes user intents (Greetings, Capabilities, Risk Explanation, Recent Changes, Vital Trends, Missing Data, Patient Summary, and General Conversation) rather than repeatedly outputting a hardcoded clinical mortality risk report.

---

## 1. Root Cause Analysis
During forensic audit, three primary root causes were identified:

1. **Static Fallback Response Template in Frontend (`src/services/aiEngine.ts`)**:
   When network connectivity to FastAPI was pending or offline, `sendGrokChatMessage` returned a static, hardcoded markdown template starting with `**Predictive Intelligence & Mortality Risk:** • In-Hospital Mortality Risk: 28.1% (ELEVATED)...` regardless of the user's message ("Hi", "Hello", "Thanks", etc.).

2. **Static Fallback Response Template in Backend (`ai-engine/grok/grok_service.py`)**:
   When LLM API keys were unavailable or API calls failed/timed out, `call_grok_chat` unconditionally called `format_interactive_clinical_response()`, which formatted the exact same static mortality risk report for every query.

3. **Aggressive System Prompt & Indiscriminate Context Injection**:
   The LLM `SYSTEM_PROMPT` instructed: *"ALWAYS respond directly with structured interactive clinical insights for the active patient."* and injected the entire `PREDICTIVE INTELLIGENCE` block into every prompt, forcing the LLM to output a full mortality risk summary even for simple greetings like "Hi" or "Hello".

---

## 2. Files Modified & Created

| File | Type | Modifications |
| :--- | :--- | :--- |
| [`ai-engine/grok/grok_service.py`](file:///e:/yuva/ai-engine/grok/grok_service.py) | Backend Service | Implemented `detect_intent()`, `format_intent_response()`, intent-based context selection, and updated `SYSTEM_PROMPT`. |
| [`backend/api/main.py`](file:///e:/yuva/backend/api/main.py) | FastAPI Backend | Updated `GrokChatRequest` schema to accept optional `intent` and `request_id`, and updated `/ai/chat` endpoint to pass `provided_intent`. |
| [`src/services/aiEngine.ts`](file:///e:/yuva/src/services/aiEngine.ts) | Frontend Service | Implemented `detectClientIntent()` and `generateClientFallbackResponse()` for intent-aware offline fallback. |
| [`src/components/RobotAIRobotAssistant.tsx`](file:///e:/yuva/src/components/RobotAIRobotAssistant.tsx) | React UI Component | Updated quick action handlers to supply explicit intents (`patient_summary`, `risk_explanation`, `recent_changes`, `trends`, `missing_data`) and generated unique `request_id`s per message. |
| [`tests/test_ai_chat_intents.py`](file:///e:/yuva/tests/test_ai_chat_intents.py) | Unit Test Suite | Created 17 automated tests verifying intent classification, greeting behavior, risk explanation, context filtering, and security checks. |

---

## 3. Architecture & Intent System

### Supported Intents & Routing Matrix

| Intent Key | Sample User Queries | Intent Behavior & Output |
| :--- | :--- | :--- |
| `greeting` | "Hi", "Hello", "Hey", "How are you?" | Friendly conversational greeting offering assistance. **No mortality report.** |
| `capabilities` | "What can you do?", "How can you help?" | Explains available NeuroCare AI capabilities (risk, changes, trends, missing data). |
| `patient_summary` | "Explain patient", "Summarize patient" | Concise clinical summary (demographics, latest vitals, neurological status). |
| `risk_explanation` | "Explain risk", "Why is risk elevated?", "SHAP factors" | Detailed structured risk explanation (mortality %, risk band, SHAP factors, data quality). |
| `recent_changes` | "What changed?", "Recent changes" | Organ system trajectory changes, early warning score, trend direction. |
| `trends` | "Explain trends", "Vital trends" | Detailed vital sign trajectories (HR, BP, SpO2, RespRate, Temp, GCS). |
| `missing_data` | "What data is missing?", "Telemetry gaps" | Telemetry quality status, missing feature count, imputation method. |
| `general` | "Thanks", "Okay", "What does GCS mean?" | Natural conversational response within clinical scope. |

---

## 4. Grok & Gemini API Integration Behavior
- **API Key Security**: Verified that `XAI_API_KEY` and `GEMINI_API_KEY` are strictly isolated on the backend (FastAPI) and **NEVER exposed in frontend browser assets**.
- **Context Filtering**: Patient context is dynamically formatted based on detected intent rather than blindly dumping all predictive scores for casual conversations.
- **Safety Guardrails**: LLM instructions explicitly forbid converting model probabilities into diagnoses or fabricating unobserved clinical parameters.

---

## 5. State & Caching Fixes
- Added `request_id` (`req-{timestamp}-{random}`) and `conversation_id` (`conv-{patient_id}`) tracking per message in `RobotAIRobotAssistant.tsx`.
- Guaranteed that stale responses are never rendered or reused across consecutive messages.

---

## 6. Verified Conversation Examples

### Example 1: Greeting
- **User**: `"Hi"`
- **Response**: `"Hello! I'm NeuroCare AI. I can help you understand Patient #132547's verified clinical data, risk factors, trends, and missing measurements. What would you like to know?"`

### Example 2: Explain Risk
- **User**: `"Explain risk"`
- **Response**:
  ```markdown
  **NeuroCare AI — Risk Explanation (Patient #132547)**

  **Model Prediction:**
  • In-Hospital Mortality Probability: `28.1%`
  • Risk Band: `ELEVATED`

  **Main Model-Associated SHAP Factors:**
  • `GCS_last`
  • `GCS_mean`
  • `Urine_mean`

  **Current Relevant Observations:**
  • GCS: `12 /15` | Urine Output: `45 mL`
  • Heart Rate: `92 bpm` | MAP: `74 mmHg`
  • Early Warning Trajectory: `WATCH` (Score: `35/100`, Trend: `UNSTABLE`)

  **Interpretation:**
  These SHAP features represent the primary mathematical contributors to the model's in-hospital mortality risk estimate.

  *Important: This is a verified machine learning prediction model result, not a clinical diagnosis.*
  ```

### Example 3: Recent Changes
- **User**: `"What changed recently?"`
- **Response**:
  ```markdown
  **NeuroCare AI — Recent Changes (Patient #132547)**

  • **Early Warning Trajectory:** `WATCH` (Score: `35/100`)
  • **Trend Direction:** `UNSTABLE`
  • **Key Physiological Signals:** `GCS_last, SaO2_last`
  • **Telemetry Data Quality:** `GOOD`

  The Early Warning Engine monitors real-time changes in organ system parameters over the preceding hours.
  ```

### Example 4: Follow-up Conversation
- **User**: `"Thanks"`
- **Response**: `"You're welcome! Let me know if you need any further insights on Patient #132547."`

---

## 7. Verification & UI Preservation Status
- **Automated Unit Tests**: `77 / 77 PASSED` (`python -m unittest discover tests`)
- **TypeScript Compilation & Production Build**: `CLEAN (0 errors)` (`npm run build`)
- **UI Design**: **100% PRESERVED**. Doctor Assistant floating button, compact panel, colors, typography, and quick action buttons remain visually identical.

---

## Conclusion
The NeuroCare AI Chatbot conversational intent bug is **FULLY RESOLVED**.
