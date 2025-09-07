Webcam AI App — Product Requirements Document (PRD)

**Summary**
- **Product**: Web app that turns a user’s webcam snapshot (or uploaded image) into a multi‑scene character‑consistent short video with optional voiceover and background music.
- **Core Flow**: Capture/upload character reference → choose 1–5 scenes → describe desired video → AI generates scene prompts, character images, per‑scene video, VO script, and music → FFMPEG merges media → user previews and downloads.
- **Primary Users**: Creators, marketers, casual users wanting fast character‑consistent clips.

**Goals**
- **Fast concept‑to‑video**: Produce a coherent multi‑scene video from a single reference image in one run.
- **Character consistency**: Maintain visual continuity across scenes via rolling reference images.
- **Simple controls**: Minimal inputs (scenes count, short description) with sensible defaults.
- **Shareable output**: MP4 file, playable in‑app with a download option.

**Non‑Goals**
- **Advanced NLE**: No timeline editing, keyframing, multi‑track mixing UI.
- **Fine‑tuned model training**: No user‑specific model fine‑tuning.
- **Multi‑character scenes**: Out of scope for v1.

**Personas**
- **Creator**: Wants to quickly storyboard and render character‑consistent clips for social posts.
- **Marketer**: Needs simple promos; values predictability, captions/VO, and brand consistency.
- **Hobbyist**: Casual experimentation; values low friction and fun results.

**Key User Stories**
- As a user, I can take a webcam snapshot or upload an image to set my character reference.
- As a user, I can select 1–5 scenes and describe my desired video in a short prompt.
- As a user, I can generate a video and see progress per stage (prompts, images, videos, audio, merge).
- As a user, I can preview the final video and download an MP4.

**User Flow**
- Launch app → grant webcam permission (or choose Upload) → capture/upload character image → select scenes (1–5) → enter short description → click Generate → see staged progress → preview → download.

**Functional Requirements**
- **Capture/Upload**: Webcam capture with fallback to image upload (PNG/JPG/WebP). Store original in `./images`.
- **Scenes**: Dropdown 1–5, default 3. Optional per‑scene seed (hidden from UI in v1).
- **Prompt**: Single short text describing tone, setting, and action; used to derive all downstream prompts.
- **Generate CTA**: Disabled during processing. Shows spinner and stage captions.
- **Progress UI**: Stage steps with live status: Prompts → Images → Videos → VO → Music → Merge. Include ETA where possible.
- **Output Player**: HTML5 player for final MP4 with filename, duration, resolution; Download button.
- **Asset Storage**:
  - Images: `./images/<session-id>/scene-<n>.png`
  - Videos: `./video/<session-id>/scene-<n>.mp4` and `./video/<session-id>/final.mp4`
  - Transient text (prompts/scripts): `./runs/<session-id>/` (optional for debugging).

**AI Orchestration Pipeline**
- **Prompt generation (OpenAI GPT‑5‑nano)**:
  - Scene prompts for Ideogram Character (1..N).
  - Voiceover script matching scenes (optional VO).
  - Instrumental music prompt.
  - Video prompts for Kling 2.1 per scene.
- **Image generation (Replicate — Ideogram Character)**:
  - Scene 1 uses the user’s reference image.
  - Scenes 2..N chain previous scene image as the new reference (“rolling reference”).
  - Save each scene image to `./images/<session-id>/scene-<n>.png`.
- **Video generation (Replicate — Kling v2.1)**:
  - For each scene, call `kwaivgi/kling-v2.1` with `start_image` set to the scene image and `prompt` from OpenAI.
  - Save each clip to `./video/<session-id>/scene-<n>.mp4`.
- **Voiceover (Eleven Labs TTS)**:
  - Generate VO MP3 from script (if VO enabled). Save to `./video/<session-id>/vo.mp3`.
- **Music (Eleven Labs Music)**:
  - Generate instrumental track from music prompt. Save to `./video/<session-id>/music.mp3`.
- **Merge (FFMPEG)**:
  - Concatenate per‑scene videos in order.
  - Mix audio: music at 20% gain, VO at 100% if present.
  - Output `final.mp4` in session folder.
- **Retries/Recovery**:
  - Each external call retried with exponential backoff (e.g., 3 attempts).
  - If a scene fails after retries, allow “Regenerate scene” from the UI.

**APIs and Configuration**
- **OpenAI**: Responses API with `gpt-5-nano` for prompt/script generation (see `docs/openai.md`).
- **Replicate**: `ideogram-ai/ideogram-character` and `kwaivgi/kling-v2.1` (see `docs/ideogram.md`, `docs/kling-21.md`).
- **Eleven Labs**: TTS and Music APIs (see `docs/eleven_labs.md`).
- **Environment Variables**:
  - `OPENAI_API_KEY`: required.
  - `ELEVENLABS_API_KEY`: required for VO/Music.
  - `REPLICATE_API_TOKEN`: required for Replicate. Note: current `.env` uses `REPLICATE_API_KEY`; support both or rename to `REPLICATE_API_TOKEN` for consistency with SDK docs.
- **Secrets Handling**: Never expose keys client‑side. Route all model calls through the server.

**UX and Constraints**
- **Formats**: Input images PNG/JPG/WebP ≤ 10MB. Output MP4 H.264/AAC.
- **Resolution**: Default 720p; configurable later. Clamp to model limits.
- **Scene length**: Target 4–6 seconds per scene; default 5s. Total runtime ≤ 30s in v1.
- **Accessibility**: Keyboard‑navigable UI; clear status text alongside spinners; color‑contrast compliant.
- **Responsive**: Mobile and desktop layouts; player fits viewport.
- **Errors**: Human‑readable messages with action suggestions (retry, reduce scenes, lower resolution).

**Performance Targets**
- **Time to first frame (image gen)**: < 30s for 3 scenes (network‑dependent).
- **End‑to‑end (3 scenes, with VO+music)**: P50 ≤ 3–5 min; P95 ≤ 8 min.
- **Throughput**: Single job per user at a time in v1; queue others.

**Operational Requirements**
- **FFMPEG**: System dependency. Detect availability at startup and fail fast with instructions.
- **Temp Cleanup**: Option to purge `./images` and `./video` older than 7 days.
- **Logging**: Structured logs per stage with `session-id`; avoid logging PII or full prompts by default.
- **Observability**: Emit stage timings and failure reasons (to console or simple file sink in v1).

**Security & Privacy**
- Do not persist API keys in client code or logs.
- Store user uploads and generated assets locally by default; if hosted, document data retention.
- Content policy: disallow harmful or copyrighted likeness prompts; show usage warning.

**Cost Controls**
- Limit scenes to ≤ 5; default 3.
- Default 720p; restrict 1080p behind config to manage cost.
- Hard cap on max concurrent jobs per server instance.

**Telemetry (Optional in v1)**
- Track: session started, webcam granted/denied, image uploaded, generation started, per‑stage durations, success/failure, download clicked.

**Edge Cases**
- Webcam denied → require upload path.
- Non‑face or low‑quality reference → warn and proceed.
- API rate limit → backoff and surface clear status.
- Partial generation success → allow per‑scene regeneration and re‑merge.

**Acceptance Criteria**
- Given a valid reference image, 1–5 scenes, and a short description, the app:
  - Generates per‑scene prompts (OpenAI) and saves them to run artifacts.
  - Produces N images with rolling reference and saves to `./images/<session-id>/`.
  - Produces N videos with Kling using each scene image and prompt and saves to `./video/<session-id>/`.
  - Optionally generates VO and music and saves MP3s.
  - Merges clips and mixes audio to produce `final.mp4`.
  - Displays playable preview and enables download.
  - Shows progress stages and handles recoverable errors with retry.

**Milestones**
- M1: Basic UI (capture/upload, scenes, description, generate) + OpenAI prompts + Ideogram images.
- M2: Kling per‑scene video + FFMPEG merge, preview, download.
- M3: Eleven Labs TTS + Music + audio mix in FFMPEG.
- M4: Robust progress UI, retries, and error handling.
- M5: Polish (responsive, accessibility, cleanup job, basic telemetry).

**Open Questions**
- Final aspect ratio default (16:9 vs 9:16) and whether user‑selectable in v1.
- Target clip duration per scene (fixed vs variable by prompt).
- VO: global single take vs per‑scene stitched VO.
- Caching: reuse scene images/videos for identical prompts or seeds?
- Hosting: local‑only vs deploy target and storage strategy (S3, etc.).

**Risks**
- External model availability, latency, and policy changes.
- Cost variability with scene count and resolution.
- Reference image inconsistencies across models leading to drift; may require prompt tuning.

**Technical Notes / Implementation Hints**
- Use Replicate SDK; prefer webhooks for long‑running jobs where possible (see docs for predictions + webhooks) or poll with backoff.
- Map env var `REPLICATE_API_KEY` → `REPLICATE_API_TOKEN` if present to match SDK expectations.
- Isolate orchestration in a job runner to enable queued processing and retries.
- Name assets with timestamps and session IDs to avoid collisions.

