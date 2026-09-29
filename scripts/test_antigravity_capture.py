"""Synthetic tests for Antigravity capture adapter."""

import io
import json
import os
from pathlib import Path
import tempfile
import unittest

import antigravity_capture
import agent_capture


class AntigravityCaptureTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config = {"author": "Pranjulchaurasiya", "project": "higgsfield-lite"}
        (self.root / "capture.config.json").write_text(json.dumps(self.config), encoding="utf-8")
        self.session_id = "test-session-ag-1234"
        self.transcript_dir = self.root / ".system_generated" / "logs"
        self.transcript_dir.mkdir(parents=True, exist_ok=True)
        self.transcript_path = self.transcript_dir / "transcript.jsonl"
        self.transcript_full_path = self.transcript_dir / "transcript_full.jsonl"

    def tearDown(self):
        self.temp.cleanup()

    def write_transcript(self, records: list[dict], full_records: list[dict] | None = None):
        with self.transcript_path.open("w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        if full_records is not None:
            with self.transcript_full_path.open("w", encoding="utf-8") as f:
                for r in full_records:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")

    def make_event(self, **kwargs):
        event = {
            "conversationId": self.session_id,
            "workspacePaths": [str(self.root)],
            "transcriptPath": str(self.transcript_path),
            "artifactDirectoryPath": str(self.root / "artifacts"),
            "modelName": "gemini-3.8-flash",
            "invocationNum": 1,
            "initialNumSteps": 0,
        }
        event.update(kwargs)
        return event

    def test_extract_user_prompt(self):
        # Case 1: Standard wrapped prompt
        raw1 = (
            "<USER_REQUEST>\nCAPTURE TEST - antigravity, Pranjul\n</USER_REQUEST>\n"
            "<ADDITIONAL_METADATA>\ntime: 12:00\n</ADDITIONAL_METADATA>"
        )
        self.assertEqual(antigravity_capture.extract_user_prompt(raw1), "CAPTURE TEST - antigravity, Pranjul")

        # Case 2: Windows newlines inside USER_REQUEST
        raw2 = (
            "<USER_REQUEST>\r\nLine 1\r\nLine 2 — Unicode नमस्ते\r\n</USER_REQUEST>\r\n"
            "<ADDITIONAL_METADATA>\r\ntime: 12:00\r\n</ADDITIONAL_METADATA>"
        )
        self.assertEqual(antigravity_capture.extract_user_prompt(raw2), "Line 1\r\nLine 2 — Unicode नमस्ते")

        # Case 3: Raw prompt without tags
        raw3 = "Raw prompt test"
        self.assertEqual(antigravity_capture.extract_user_prompt(raw3), "Raw prompt test")

    def test_pre_invocation_dedup_and_stop_capture(self):
        """PreInvocation fires multiple times during tool use; prompt must be logged once."""
        records = [
            {
                "step_index": 0,
                "source": "USER_EXPLICIT",
                "type": "USER_INPUT",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:00Z",
                "content": "<USER_REQUEST>\nCAPTURE TEST - antigravity, Pranjul\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\ninfo\n</ADDITIONAL_METADATA>",
            },
            {
                "step_index": 1,
                "source": "MODEL",
                "type": "PLANNER_RESPONSE",
                "status": "DONE",
                "thinking": "Thinking about calling tool...",
                "tool_calls": [{"name": "view_file", "args": {"AbsolutePath": "foo.txt"}}],
            },
        ]
        self.write_transcript(records)

        # 1st PreInvocation
        ev1 = self.make_event(invocationNum=1)
        log_path = antigravity_capture.capture_antigravity(ev1, root=self.root, config=self.config)
        self.assertIsNotNone(log_path)
        content_after_inv1 = log_path.read_text(encoding="utf-8")
        self.assertIn("CAPTURE TEST - antigravity, Pranjul", content_after_inv1)
        self.assertIn("model: \"gemini-3.8-flash\"", content_after_inv1)
        self.assertEqual(content_after_inv1.count("[LOG_ENTRY type=PROMPT"), 1)
        self.assertEqual(content_after_inv1.count("[LOG_ENTRY type=RESPONSE"), 0)

        # 2nd PreInvocation (after tool execution)
        ev2 = self.make_event(invocationNum=2)
        log_path_inv2 = antigravity_capture.capture_antigravity(ev2, root=self.root, config=self.config)
        self.assertIsNone(log_path_inv2)  # Deduped: unchanged, returns None
        self.assertEqual(log_path.read_text(encoding="utf-8"), content_after_inv1)

        # 3rd PreInvocation
        ev3 = self.make_event(invocationNum=3)
        log_path_inv3 = antigravity_capture.capture_antigravity(ev3, root=self.root, config=self.config)
        self.assertIsNone(log_path_inv3)
        self.assertEqual(log_path.read_text(encoding="utf-8"), content_after_inv1)

        # Model finishes: appends final PLANNER_RESPONSE and Stop fires
        records.append({
            "step_index": 2,
            "source": "MODEL",
            "type": "PLANNER_RESPONSE",
            "status": "DONE",
            "created_at": "2026-09-30T00:00:05Z",
            "content": "Acknowledged — antigravity canary.",
            "thinking": "Final thought that must be excluded",
        })
        self.write_transcript(records)

        stop_ev = self.make_event(executionNum=1, terminationReason="model_stop", fullyIdle=True)
        log_path_stop = antigravity_capture.capture_antigravity(stop_ev, root=self.root, config=self.config)
        self.assertIsNotNone(log_path_stop)

        final_text = log_path.read_text(encoding="utf-8")
        self.assertEqual(final_text.count("[LOG_ENTRY type=PROMPT"), 1)
        self.assertEqual(final_text.count("[LOG_ENTRY type=RESPONSE"), 1)
        self.assertIn("Acknowledged — antigravity canary.", final_text)
        self.assertNotIn("Thinking about calling tool", final_text)
        self.assertNotIn("Final thought that must be excluded", final_text)
        self.assertNotIn("view_file", final_text)
        self.assertIn("tool: \"antigravity-ide\"", final_text)

    def test_multi_turn_session(self):
        """Verifies multi-turn sequence: Prompt 1 -> Resp 1 -> Prompt 2 -> Resp 2."""
        records = [
            # Turn 1
            {
                "step_index": 0,
                "source": "USER_EXPLICIT",
                "type": "USER_INPUT",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:00Z",
                "content": "<USER_REQUEST>\nFirst prompt\n</USER_REQUEST>",
            },
            {
                "step_index": 1,
                "source": "MODEL",
                "type": "PLANNER_RESPONSE",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:02Z",
                "content": "First response",
            },
            # Turn 2
            {
                "step_index": 2,
                "source": "USER_EXPLICIT",
                "type": "USER_INPUT",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:10Z",
                "content": "<USER_REQUEST>\nSecond prompt\n</USER_REQUEST>",
            },
            {
                "step_index": 3,
                "source": "MODEL",
                "type": "PLANNER_RESPONSE",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:15Z",
                "content": "Second response",
            },
        ]
        self.write_transcript(records)

        ev = self.make_event()
        log_path = antigravity_capture.capture_antigravity(ev, root=self.root, config=self.config)
        text = log_path.read_text(encoding="utf-8")

        self.assertEqual(text.count("[LOG_ENTRY type=PROMPT"), 2)
        self.assertEqual(text.count("[LOG_ENTRY type=RESPONSE"), 2)
        self.assertIn("total_exchanges: 2", text)
        self.assertIn("[LOG_ENTRY type=PROMPT num=1", text)
        self.assertIn("First prompt", text)
        self.assertIn("[LOG_ENTRY type=RESPONSE num=1", text)
        self.assertIn("First response", text)
        self.assertIn("[LOG_ENTRY type=PROMPT num=2", text)
        self.assertIn("Second prompt", text)
        self.assertIn("[LOG_ENTRY type=RESPONSE num=2", text)
        self.assertIn("Second response", text)

    def test_transcript_full_priority_for_long_content(self):
        """Ensure adapter prefers transcript_full.jsonl if present to avoid truncated text."""
        truncated_records = [
            {
                "step_index": 0,
                "source": "USER_EXPLICIT",
                "type": "USER_INPUT",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:00Z",
                "content": "<USER_REQUEST>\nTruncated prompt...\n</USER_REQUEST>",
                "is_truncated": True,
            },
            {
                "step_index": 1,
                "source": "MODEL",
                "type": "PLANNER_RESPONSE",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:05Z",
                "content": "Truncated response...",
                "is_truncated": True,
            },
        ]
        full_records = [
            {
                "step_index": 0,
                "source": "USER_EXPLICIT",
                "type": "USER_INPUT",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:00Z",
                "content": "<USER_REQUEST>\nFull Untruncated Prompt: " + ("Z" * 1000) + "\n</USER_REQUEST>",
            },
            {
                "step_index": 1,
                "source": "MODEL",
                "type": "PLANNER_RESPONSE",
                "status": "DONE",
                "created_at": "2026-09-30T00:00:05Z",
                "content": "Full Untruncated Response: " + ("A" * 1000),
            },
        ]
        self.write_transcript(truncated_records, full_records=full_records)

        ev = self.make_event()
        log_path = antigravity_capture.capture_antigravity(ev, root=self.root, config=self.config)
        text = log_path.read_text(encoding="utf-8")
        self.assertIn("Z" * 1000, text)
        self.assertIn("A" * 1000, text)


if __name__ == "__main__":
    unittest.main()
