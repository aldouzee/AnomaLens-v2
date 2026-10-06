# AnomaLens – Vercel Deployment Manual

How to put the AnomaLens dashboard (React) and API (FastAPI) online with Vercel, so the demo can be opened from any browser through a public link.

> **Verified against Vercel's documentation in October 2026.** Dashboard labels, limits and beta features change; if a step differs from what you see, follow the linked Vercel docs (section 11).

---

## 1. Deployment Plan at a Glance

The repository is a monorepo (`frontend/`, `backend/`, `ml/`). On Vercel it becomes **two projects** that come from the same Git repository:

| Vercel project | Root directory | What it serves | Example URL |
|---|---|---|---|
| `anomalens-api` | `backend` | FastAPI (`/predict`, `/models`, `/stats`, `/ws/stream`, `/docs`) | `https://anomalens-api.vercel.app` |
| `anomalens-web` | `frontend` | React dashboard (Vite build) | `https://anomalens-web.vercel.app` |

**Order matters:** deploy the API first (the frontend needs its URL), then the frontend, then go back and tell the API the frontend's URL (CORS).

```
Browser ──▶ anomalens-web (static React build)
   │
   └──── HTTPS + WSS ──▶ anomalens-api (FastAPI on Vercel Functions)
                              └── loads *.joblib models bundled with the deployment
```

### 1.1 What is different from running locally

| Local / Docker | On Vercel |
|---|---|
| Models mounted from `ml/artifacts` | Models must be **inside the deployed `backend` folder** |
| Long-running Uvicorn process | **Serverless function**; instances start and stop on demand |
| `/stats` history kept in one process | Each function instance has its **own** memory; history can reset or differ between instances |
| WebSocket stays open indefinitely | WebSocket works (public beta) but **closes at the function's maximum duration**; the client must reconnect |
| `.env` file | Environment variables set in the Vercel dashboard |

Read section 9 (limitations) before presenting from the deployed version.

---

## 2. Prerequisites

- A Vercel account (a free Hobby account is enough for a course demo; check Vercel's current plan terms for your use).
- A GitHub (or GitLab/Bitbucket) account with the project pushed to a repository.
- Models already trained locally (`ml/artifacts/` contains the seven `*.joblib` files, `metrics.json` and `stream_sample.csv`).
- Node.js 18+ and Python installed locally (for the optional CLI route and for testing).
- Optional: Vercel CLI – `npm install -g vercel`.

---

## 3. Prepare the Repository

> **Already done in this repository:** the entrypoint (`backend/index.py`), `backend/vercel.json`, `backend/.python-version` (3.14, the version used for training), pinned `backend/requirements.txt`, the artifacts-path default (3.4) and a copy of the trained models in `backend/artifacts/`. After **retraining**, refresh the copy with `python sync_backend_artifacts.py` (run inside `ml/`) and commit it. Sections 3.1–3.5 explain the reasoning; repeat them only if something changes.

### 3.1 Match the Python and library versions used for training

Saved `.joblib` models only load reliably with the **same scikit-learn version** that trained them. Before deploying:

```bash
cd ml
pip freeze | findstr /I /R "scikit-learn imbalanced-learn numpy pandas scipy joblib"
```

Pin those exact versions in `backend/requirements.txt`, for example:

```
fastapi
pydantic
python-multipart
scikit-learn==<your version>
imbalanced-learn==<your version>
numpy==<your version>
pandas==<your version>
joblib==<your version>
```

Vercel's Python runtime defaults to Python 3.12 and also offers 3.13 and 3.14. Pin the version you trained with by adding a `.python-version` file inside `backend/` (for example, a single line `3.12`). Your overview notes development on a newer Python, so pick a version Vercel offers and, if it differs from the one used for training, retrain once under that version so the saved models match.

### 3.2 Put the model files inside `backend/`

A project with root directory `backend` cannot see `../ml/artifacts`. Copy the artifacts into the backend folder:

```bash
cd ml && python sync_backend_artifacts.py     # copies only the models listed in metrics.json
```

The script leaves out stale models such as `lof.joblib` (anything not listed in `metrics.json`).

Make sure `.gitignore` does **not** exclude these files (check for `*.joblib` or `artifacts/` patterns); Vercel builds from Git, so ignored files never arrive.

Check the total size (the Python function limit is **500 MB uncompressed**, which must hold the libraries and the models together):

```bash
dir /s backend\artifacts
```

### 3.3 Add the entrypoint

Vercel looks for a FastAPI instance named `app` at a supported entrypoint. Your instance lives in `backend/app/main.py`, so add a small file at the backend root, `backend/index.py`:

```python
from app.main import app  # Vercel serves the FastAPI instance named "app"
```

(If Vercel reports that it cannot find an entrypoint, compare with the entrypoint list on the FastAPI page linked in section 11.)

### 3.4 Make `ARTIFACTS_DIR` resolve inside the bundle

Open `backend/app/core/config.py` and check how `ARTIFACTS_DIR` is turned into a path. A path like `artifacts` is resolved relative to the **working directory**, which in a serverless function may not be the folder you expect. The most robust approach is to compute the default from the file's own location:

```python
from pathlib import Path
DEFAULT_ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts"   # backend/artifacts
```

Use that as the default when the `ARTIFACTS_DIR` environment variable is not set, so the same code works locally, in Docker (where the variable is set) and on Vercel.

### 3.5 Ensure the models are included in the bundle

Vercel ships files reachable at build time. If the API starts but reports that no models are loaded (HTTP 503), force-include the folder with a `backend/vercel.json`:

```json
{
  "functions": {
    "index.py": {
      "includeFiles": "artifacts/**"
    }
  }
}
```

### 3.6 Test locally before pushing

```bash
cd backend
uvicorn app.main:app --port 8000
# open http://localhost:8000/health and confirm all seven models are listed
```

Commit and push everything:

```bash
git add backend/index.py backend/artifacts backend/requirements.txt backend/.python-version backend/vercel.json
git commit -m "Prepare backend for Vercel"
git push
```

---

## 4. Deploy the API (Backend)

### 4.1 Using the Vercel dashboard

1. Go to **vercel.com → Add New… → Project**.
2. **Import** your Git repository (authorise Vercel to access it if asked).
3. Set **Project Name** to `anomalens-api`.
4. Set **Root Directory** to `backend` (click *Edit*, select the folder).
5. Leave the framework preset on the detected value (FastAPI/Python) or *Other*. No build command is needed.
6. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `CORS_ORIGINS` | `http://localhost:5173` for now; you will change it in step 6.3 |
| `ARTIFACTS_DIR` | Only if your `config.py` needs it (see 3.4); otherwise omit |

7. Click **Deploy** and wait for the build to finish.

### 4.2 Using the CLI (alternative)

```bash
cd backend
vercel login
vercel            # creates a preview deployment; answer the prompts, name it anomalens-api
vercel --prod     # promotes to production
```

### 4.3 Enable Fluid Compute for WebSockets

WebSocket support on Vercel Functions requires **Fluid Compute**, which is on by default for projects created on or after April 23, 2025. For an older project: **Project → Settings → Functions → enable Fluid Compute**, then redeploy.

### 4.4 Verify the API

Open these in the browser (replace the host with your own):

- `https://anomalens-api.vercel.app/health` → status OK with seven model ids.
- `https://anomalens-api.vercel.app/docs` → interactive API docs; try `POST /predict` with the example record from the project overview.
- `https://anomalens-api.vercel.app/models` → metrics for all models.

Do not continue until `/health` lists all seven models.

---

## 5. Deploy the Dashboard (Frontend)

### 5.1 Prepare

1. Confirm the production build works locally:

```bash
cd frontend
npm install
npm run build        # must finish without errors and create dist/
```

2. The API address is read from `VITE_API_URL` **at build time**. Check `src/api/client.js` so that:
   - REST calls use `VITE_API_URL` as the base URL; and
   - the WebSocket URL is derived from it by replacing `https://` with `wss://` (a page served over HTTPS cannot open an insecure `ws://` connection; browsers block it).

### 5.2 Deploy with the dashboard

1. **Add New… → Project**, import the **same repository** again.
2. **Project Name:** `anomalens-web`.
3. **Root Directory:** `frontend`.
4. **Framework Preset:** Vite (usually detected automatically). Build command `npm run build`, output directory `dist`.
5. **Environment Variables:**

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://anomalens-api.vercel.app` (your API's production URL, no trailing slash) |

6. Click **Deploy**.

### 5.3 CLI alternative

```bash
cd frontend
vercel
vercel env add VITE_API_URL production      # paste the API URL when prompted
vercel --prod
```

---

## 6. Connect the Two Projects (CORS)

1. Copy the dashboard's production URL, for example `https://anomalens-web.vercel.app`.
2. In the **`anomalens-api`** project: **Settings → Environment Variables → edit `CORS_ORIGINS`** and set it to the dashboard URL (exact match, no trailing slash). If the code accepts a comma-separated list, add `http://localhost:5173` as well for local work.
3. **Redeploy** the API (**Deployments → ⋯ → Redeploy**). Environment variable changes only apply to new deployments.
4. Reload the dashboard. If the browser console shows a CORS error, the origin in `CORS_ORIGINS` does not match exactly (check `https`, spelling, and trailing slash).

> Vercel also creates preview URLs for every branch or pull request (for example `anomalens-web-git-feature-….vercel.app`). They are different origins; add them to `CORS_ORIGINS` only if you need to test previews against the API.

---

## 7. End-to-End Verification Checklist

- [ ] Dashboard loads at the production URL without console errors.
- [ ] Summary cards and **Model comparison** show the seven models and their metrics (proves `GET /models` works).
- [ ] **Score records** – submit one record to a single model and to **All models**.
- [ ] **Batch upload** – upload a small CSV and download the results.
- [ ] **Live monitor** – start the stream; points appear on the chart and in the feed. Leave it running for a few minutes and confirm it **reconnects** after the connection closes (see section 9).
- [ ] Reload the page after a minute of idle time; the first request may be slower (cold start).

---

## 8. Updating the Deployment

| What changed | What to do |
|---|---|
| Frontend code | `git push`; Vercel rebuilds `anomalens-web` automatically |
| Backend code | `git push`; Vercel rebuilds `anomalens-api` automatically |
| Retrained models | Re-run the `ml/` scripts → copy the new files into `backend/artifacts/` → commit and push |
| `VITE_API_URL` changed | Update the variable and **redeploy the frontend** (it is baked in at build time) |
| `CORS_ORIGINS` or other API variables | Update, then **redeploy the API** |

Pushes to the production branch (usually `main`) deploy to production; other branches get preview deployments. **Deployments → ⋯ → Instant Rollback** returns to a previous working version.

---

## 9. Known Limitations on Vercel

- **WebSockets are in public beta** on Vercel Functions (Python support added in July 2026), so behaviour may change. Each connection closes when the function reaches its maximum duration (300 seconds on the Hobby plan); the dashboard's auto-reconnect handles this, but the live chart may briefly pause.
- **No shared memory between instances.** `/stats`, the recent-predictions list and the counters are kept in memory, so they can reset when an instance is recycled, or differ if two requests reach different instances. For a reliable history, store it in an external database (for example Redis from the Vercel Marketplace).
- **Cold starts.** The first request after idle time loads seven models and can take several seconds. Open the dashboard and press a button once before the presentation starts.
- **Bundle size.** The libraries plus all models must fit in 500 MB uncompressed. If the build fails on size, remove unused files (such as `lof.joblib`) and unused dependencies.
- **Single bundle.** The whole FastAPI app is one function; there is no separate worker process.

**Fallback if WebSockets misbehave in the beta:** keep the dashboard on Vercel and host the API on a container-based service using the existing `backend/Dockerfile`, then set `VITE_API_URL` to that service's URL and redeploy the frontend. Everything else in this manual stays the same.

---

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: function exceeds size limit | Bundle larger than 500 MB | Check `du -sh backend/artifacts`, remove stale models, trim dependencies |
| Build fails: no entrypoint found | FastAPI `app` not at a supported path | Add `backend/index.py` (section 3.3) and set Root Directory to `backend` |
| API returns **503** "no models loaded" | Artifacts not in the bundle or wrong `ARTIFACTS_DIR` | Check 3.2, 3.4 and 3.5; confirm files are committed to Git |
| Error when loading a model (unpickling / version error) | scikit-learn or Python version differs from training | Pin exact versions (3.1) or retrain under the deployed versions |
| Dashboard shows network error / CORS error in console | `CORS_ORIGINS` mismatch or API not redeployed | Fix the value, redeploy the API (section 6) |
| Dashboard calls `localhost` or the wrong API | `VITE_API_URL` missing at build time | Set it for the **Production** environment and redeploy the frontend |
| Live monitor never connects | `ws://` used on an HTTPS page, Fluid Compute off, or beta issue | Use `wss://` (5.1), enable Fluid Compute (4.3), or use the fallback in section 9 |
| Live feed stops after a few minutes | Connection reached the maximum duration | Expected; confirm the client reconnects automatically |
| Stats or history disappear | Instance was recycled | Expected without an external store (section 9) |
| First request very slow | Cold start while models load | Warm up before presenting |
| 404 on the dashboard after refresh | Client-side routing without a rewrite (only if routes were added) | Add a `frontend/vercel.json` rewrite of all paths to `/index.html` |

**Where to look:** project → **Deployments** → select a deployment → **Build Logs** (build problems) and **Logs / Runtime Logs** (errors while the API is running).

---

## 11. Reference Links

- Vercel – Deploy a FastAPI app: https://vercel.com/docs/frameworks/backend/fastapi
- Vercel – WebSockets on Vercel Functions: https://vercel.com/docs/functions/websockets
- Vercel – Do Vercel Functions support WebSocket connections? https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Vercel – Functions limits (bundle size, duration): https://vercel.com/docs/functions/limitations
- Vercel – Environment variables: https://vercel.com/docs/environment-variables

## 12. Quick Reference

```text
1. Train models                    → ml/artifacts/
2. Pin library + Python versions   → backend/requirements.txt, .python-version
3. Copy models                     → backend/artifacts/
4. Add entrypoint                  → backend/index.py
5. Deploy API                      → Vercel project, Root Directory = backend
6. Deploy dashboard                → Vercel project, Root Directory = frontend, VITE_API_URL = API URL
7. Set CORS_ORIGINS = dashboard URL → redeploy API
8. Verify with the checklist (section 7)
```
