# GitScope Profile Engine 🚀

An advanced, client-side developer analytics dashboard designed to run high-fidelity profile comparisons and data duels using live GitHub API metadata. Engineered with a heavy emphasis on structural algorithm optimization, client-side memory management, and robust protection against asynchronous network race conditions.

🌐 **Live Demo:** [resilient-croquembouche-90e46d.netlify.app](https://resilient-croquembouche-90e46d.netlify.app/)

---

## 🛠️ Key Architectural Enhancements

### 1. Multi-Variable Ranking Algorithm
Instead of relying on basic string-matching loops to deduce a user's primary development stack, GitScope implements a custom multi-variable scoring model:
* **Volume (Base Weight):** Raw repository frequency counts establish the core baseline.
* **Community Validation Matrix:** Applies a $2\times$ multiplier to community Star validation metrics to factor in real-world asset reach.
* **Adaptive Time-Decay Index:** Grants a `+5` scoring bonus for active code repos modified within the last 4 weeks, and a `+2` bonus for repositories touched within 12 weeks. This ensures legacy or archived repositories do not skew the candidate's current profile signature.

### 2. Smart Micro-Caching Layer (TTL Cache)
Engineered for strict optimization of client-side overhead and defensive management against GitHub API rate-limiting blocks (`HTTP 403 / 429`).
* Implements a **Time-To-Live (TTL)** cache configuration utilizing `localStorage`.
* Short-circuits redundant, expensive network roundtrips entirely for duplicate candidate requests executed within a **10-minute validity token window**, reducing network overhead by 100% for recurring lookups.

### 3. Asynchronous Lifecycle Management
Eliminates potential UI rendering bugs and data overlapping common in fast-paced single-page applications.
* Leverages native JavaScript **`AbortController` signals** bound directly to the active asynchronous network fetch streams.
* If a user inputs names rapidly or mashes the analytical submission nodes mid-stream, pending stale network actions are instantly terminated, fully insulating the browser's paint pipeline from delayed payload mutations.

### 4. Deterministic Profile Analytics Matrix
Fulfills data-driven application traits by mapping multi-source user vectors (public repository counts, follower traction, aggregated star metrics, and text bio profiles) against an intricate evaluation matrix to compile highly responsive developer evaluations entirely client-side.

---

## 💻 Tech Stack & Dependencies

* **Frontend Engine:** Semantic HTML5, CSS3 Custom Properties (Matrix UI Core Theme)
* **Asynchronous Logic:** Vanilla ES6+ JavaScript (`Fetch API`, `Promises`, `AbortController`)
* **Data Visualization:** Chart.js (Encapsulated Doughnut Configuration Layer)
* **Document Compilation:** html2pdf.js (Automated layout rendering structure)

---

## 🚀 Quick Local Installation

Since this engine is architected efficiently as a client-side utility, it requires no heavy server setup or external installations:

1. Clone the repository:
```bash
   git clone [https://github.com/CHANDINI-SIRI/gitscope-profile-engine.git](https://github.com/CHANDINI-SIRI/gitscope-profile-engine.git)
