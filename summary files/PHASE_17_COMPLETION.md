# Phase 17 Completion Summary — Testing, Rehearsal & Threshold Tuning (AI portion)

Files created: tests/backend/test_vad.py, test_chunker.py, test_whisper_service.py, test_ollama_client.py, test_vocab_filter.py, test_render_resolver.py, test_session_state.py, tests/fixtures/sample_audio/ (empty, awaiting real fixtures), tests/__init__.py and tests/backend/__init__.py (package markers so pytest can import backend/), pytest.ini (testpaths = tests). requirements.txt gained pytest.

No new cross-boundary signatures; these are unit tests against existing modules only.

Real Data Rule handling: tests use silence (all-zeros buffers) for VAD/Whisper/chunker negative-path and buffer-arithmetic cases, matching the pattern already used by vad.init()/whisper_service.init()'s own warm-up calls - this is a numeric edge case, not fabricated speech. render_resolver and dictionary tests use the real isl_dictionary.json already fetched (confirmed "HELLO" entry present); no CISLR clips are cached yet so video-mode lookups there genuinely exercise Fallback A, which is real current behavior, not a stand-in. ollama_client tests monkeypatch the HTTP call to test JSON-parse/vocab-filter control flow only, using plain non-demo tokens. Three tests are marked skip/skipif pending real material: a real-speech VAD/Whisper fixture, and a live-Ollama run against a real transcribed fragment - all per the Real Data Rule.

Test run: 31 passed, 3 skipped, against the real dictionary/CISLR/Ollama/Whisper/VAD stack (found the project actually uses a .venv at .venv/ that pytest/dotenv were missing from initially - fixed by installing into that venv, not the system Python). Live server health-checked as still ready after the GPU-loading tests ran alongside it.

Ambiguity resolved: whether hand-picked word tokens in ollama_client's control-flow tests violate the Real Data Rule - resolved as no, since the rule targets demo/rehearsal content, not internal unit-test mocking of an HTTP boundary; the doc's own instruction to feed vocab_filter "known off-vocabulary and malformed-JSON cases" confirms hand-built test literals are expected here.

Human steps required before this phase is fully complete (not done, per the Real Data Rule and GPU-hardware requirement):

1. Record or export a short real voice sample (a few sentences, mono, 16 kHz WAV) and save it under tests/fixtures/sample_audio/ (any filename ending .wav). This alone will make the 3 skipped tests run on the next `pytest` invocation - no code change needed.
2. Run the app live (a real capture session) while watching `nvidia-smi` and the console; judge whether end-to-end latency holds near the 5s target under Whisper + Ollama + Three.js running together on the RTX 3050.
3. Based on that real observation, if the placeholder or a wrong pace appears too often, adjust `VAD_DISCARD_THRESHOLD` and/or `LATENCY_DEGRADE_THRESHOLD_SECONDS` in backend/config.py (currently 0.3 and 6.5) and restart the server.
4. Do a final full rehearsal run before demo day.

To run the automated suite at any time: `pytest -q` from C:\signsetu with the `.venv` activated.
